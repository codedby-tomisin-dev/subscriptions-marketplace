from datetime import date, datetime, time, timedelta, timezone
from typing import Callable

from modules.analytics import metrics
from modules.analytics.repository import AnalyticsRepository
from modules.catalog.catalog import Catalog
from modules.inventory.repository import InventoryRepository
from modules.shared.clock import now_utc

WINDOW_DAYS = 30
SHIP_DAYS = 5
# Stripe retries a failed invoice a few times; from this attempt on, the next is the last.
FINAL_RETRY_ATTEMPT = 3
LOW_STOCK_ALERTS = 3


def working_days(start: date, count: int) -> list[date]:
    days: list[date] = []
    cursor = start
    while len(days) < count:
        if cursor.weekday() < 5:
            days.append(cursor)
        cursor += timedelta(days=1)
    return days


def _iso_start_of(day: date) -> str:
    return datetime.combine(day, time(0), tzinfo=timezone.utc).isoformat(timespec="seconds")


class AnalyticsService:
    def __init__(self, repo: AnalyticsRepository, inventory: InventoryRepository, catalog: Callable[[], Catalog]) -> None:
        self._repo = repo
        self._catalog = catalog
        self._inventory = inventory

    def headline_metrics(self, today: date, subscriptions=None) -> dict:
        subscriptions = subscriptions if subscriptions is not None else self._repo.live_subscriptions()
        since = _iso_start_of(today - timedelta(days=WINDOW_DAYS))
        cancellations = metrics.effective_cancellations(self._repo.events_since(["cancelled", "cancel_undone"], since))
        active_count = len(metrics.active(subscriptions))
        cadence = metrics.cadence_counts(subscriptions, [])["all"]
        return {
            "activeSubscriptions": active_count,
            "mrrPence": metrics.monthly_recurring_revenue_pence(subscriptions),
            "churnRate": round(metrics.churn_rate(active_count, len(cancellations)), 4),
            "weekly": cadence["week"],
            "monthly": cadence["month"],
        }

    def overview(self, today: date) -> dict:
        subscriptions = self._repo.live_subscriptions()
        box_ids = [box.id for box in self._catalog().active()]
        headline = self.headline_metrics(today, subscriptions)
        previous = self._repo.snapshot_on_or_before((today - timedelta(days=WINDOW_DAYS)).isoformat())

        days = working_days(today, SHIP_DAYS)
        week_orders = [o for o in self._repo.orders_shipping_between(days[0].isoformat(), days[-1].isoformat()) if o.status != "refunded"]
        shipping_by_day = [
            {
                "date": day.isoformat(),
                "total": sum(1 for o in week_orders if o.ship_date == day.isoformat()),
                "shipped": sum(1 for o in week_orders if o.ship_date == day.isoformat() and o.status in ("shipped", "delivered")),
            }
            for day in days
        ]

        return {
            "today": today.isoformat(),
            "current": headline,
            "previous": previous,
            "shipping": {
                "byDay": shipping_by_day,
                "total": len(week_orders),
                "packed": sum(1 for o in week_orders if o.status != "topack"),
            },
            "mrrByBox": metrics.mrr_by_box(subscriptions, box_ids),
            "cadenceByBox": metrics.cadence_counts(subscriptions, box_ids),
            "attention": self._attention(today, subscriptions),
        }

    def _attention(self, today: date, subscriptions) -> list[dict]:
        items: list[dict] = []
        for item in self.stock(today, subscriptions)["shortages"][:LOW_STOCK_ALERTS]:
            items.append({"kind": "low_stock", **item})

        failed = self._repo.failed_payments_since((now_utc() - timedelta(hours=24)).isoformat(timespec="seconds"))
        if failed:
            retries = sorted(p.next_retry_at for p in failed if p.next_retry_at)
            items.append({
                "kind": "failed_payments",
                "count": len(failed),
                "finalRetryCount": sum(1 for p in failed if p.attempt_count >= FINAL_RETRY_ATTEMPT),
                "nextRetryAt": retries[0] if retries else None,
            })
        return items

    def stock(self, today: date, subscriptions=None) -> dict:
        """Per box: subscriber counts, and each item's stock against what the next round needs."""
        subscriptions = subscriptions if subscriptions is not None else self._repo.live_subscriptions()
        catalog = self._catalog()
        needed = metrics.stock_needed(metrics.boxes_due_next_round(self._repo.orders_to_pack(), subscriptions, today), catalog)
        cadence = metrics.cadence_counts(subscriptions, [box.id for box in catalog.active()])
        stock_by_id = {item.id: item for item in self._inventory.list_all()}

        boxes, shortages = [], []
        for box in catalog.active():
            items = []
            for catalog_item in box.items:
                stocked = stock_by_id.get(catalog_item.id)
                row = {
                    "itemId": catalog_item.id,
                    "name": catalog_item.name,
                    "boxId": box.id,
                    "stock": stocked.stock if stocked else 0,
                    "needed": needed[catalog_item.id],
                }
                items.append(row)
                if row["stock"] < row["needed"]:
                    shortages.append(row)
            boxes.append({"boxId": box.id, "weekly": cadence[box.id]["week"], "monthly": cadence[box.id]["month"], "items": items})

        shortages.sort(key=lambda row: row["stock"] - row["needed"])
        return {"boxes": boxes, "shortages": shortages}

    def churn(self, today: date) -> dict:
        since = _iso_start_of(today - timedelta(days=WINDOW_DAYS))
        events = self._repo.events_since(["cancelled", "cancel_undone", "paused", "cadence_changed"], since)
        cancellations = metrics.effective_cancellations(events)
        saves = metrics.save_rate([event for event in events if event.type != "cancelled"] + cancellations)
        customers = self._repo.customers([event.customer_id for event in cancellations[:10]])

        recent = []
        for event in cancellations[:10]:
            customer = customers.get(event.customer_id)
            ended = datetime.fromisoformat(event.at).date()
            recent.append({
                "customerId": event.customer_id,
                "name": (customer.name if customer else None) or (customer.email if customer else "—"),
                "boxId": event.data.get("boxId"),
                "reason": event.data.get("reason") or ("Payment failed" if event.actor == "stripe" else "—"),
                "at": event.at,
                "tenure": metrics.tenure_label(customer.member_since, ended) if customer else None,
            })

        return {
            "reasons": metrics.reason_shares([event for event in cancellations if event.actor != "stripe"]),
            "saves": {
                "pausedInstead": saves.paused_instead,
                "switchedToMonthly": saves.switched_to_monthly,
                "cancelledAnyway": saves.cancelled_anyway,
                "percentSaved": saves.percent_saved,
            },
            "recent": recent,
        }

    def write_daily_snapshot(self, today: date) -> dict:
        snapshot = self.headline_metrics(today)
        self._repo.save_snapshot(today.isoformat(), snapshot)
        return snapshot
