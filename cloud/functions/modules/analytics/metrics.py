"""Pure business metrics for the admin. Inputs are plain records; nothing here reads Firestore."""
from collections import Counter
from dataclasses import dataclass
from datetime import date, timedelta

from modules.catalog.catalog import CADENCES, Catalog
from modules.fulfilment.models import Order
from modules.subscriptions.models import Event, Subscription

CANCEL_REASONS = ("Too many boxes", "A bit pricey", "Just need a break", "Not my vibe anymore", "Something else")
FALLBACK_REASON = "Something else"
# "Needed for next round" looks this far ahead for boxes not yet charged.
NEXT_ROUND_DAYS = 7


def active(subscriptions: list[Subscription]) -> list[Subscription]:
    return [sub for sub in subscriptions if sub.status == "active"]


def monthly_recurring_revenue_pence(subscriptions: list[Subscription]) -> int:
    """Active subscriptions only, weekly ones normalised to a month."""
    return sum(sub.monthly_value_pence for sub in active(subscriptions))


def mrr_by_box(subscriptions: list[Subscription], box_ids: list[str]) -> list[dict]:
    """Every box in `box_ids` (zero if it has no subscribers), plus any other box that has some."""
    totals = Counter({box_id: 0 for box_id in box_ids})
    for sub in active(subscriptions):
        totals[sub.box_id] += sub.monthly_value_pence
    return [{"boxId": box_id, "mrrPence": pence} for box_id, pence in totals.most_common()]


def cadence_counts(subscriptions: list[Subscription], box_ids: list[str]) -> dict[str, dict[str, int]]:
    """Active subscriptions by box and cadence, plus an "all" total."""
    counts: dict[str, dict[str, int]] = {box_id: {cadence: 0 for cadence in CADENCES} for box_id in box_ids}
    counts["all"] = {cadence: 0 for cadence in CADENCES}
    for sub in active(subscriptions):
        counts.setdefault(sub.box_id, {cadence: 0 for cadence in CADENCES})[sub.cadence] += 1
        counts["all"][sub.cadence] += 1
    return counts


def churn_rate(active_now: int, cancelled_in_period: int) -> float:
    """Share of the subscriptions live during the period that cancelled in it."""
    at_risk = active_now + cancelled_in_period
    return cancelled_in_period / at_risk if at_risk else 0.0


def effective_cancellations(events: list[Event]) -> list[Event]:
    """Cancellations that stuck: one followed by a `cancel_undone` on the same subscription doesn't count."""
    kept: dict[str, list[Event]] = {}
    for event in sorted(events, key=lambda e: e.at):
        key = event.subscription_id or event.customer_id
        if event.type == "cancelled":
            kept.setdefault(key, []).append(event)
        elif event.type == "cancel_undone" and kept.get(key):
            kept[key].pop()
    return sorted((event for group in kept.values() for event in group), key=lambda e: e.at, reverse=True)


def reason_shares(cancellations: list[Event]) -> list[dict]:
    """Percent of cancellations per reason, in the cancel dialog's order. No reason counts as "Something else"."""
    reasons = Counter(event.data.get("reason") if event.data.get("reason") in CANCEL_REASONS else FALLBACK_REASON for event in cancellations)
    total = sum(reasons.values())
    shares = [{"reason": reason, "percent": round(100 * reasons[reason] / total) if total else 0} for reason in CANCEL_REASONS]
    return sorted(shares, key=lambda share: -share["percent"])


@dataclass(frozen=True)
class SaveRate:
    paused_instead: int
    switched_to_monthly: int
    cancelled_anyway: int

    @property
    def percent_saved(self) -> int:
        total = self.paused_instead + self.switched_to_monthly + self.cancelled_anyway
        return round(100 * (self.paused_instead + self.switched_to_monthly) / total) if total else 0


def save_rate(events: list[Event]) -> SaveRate:
    """Of people who opened the cancel flow: who paused, who went monthly, who left."""
    return SaveRate(
        paused_instead=sum(1 for e in events if e.type == "paused" and e.data.get("retention")),
        switched_to_monthly=sum(1 for e in events if e.type == "cadence_changed" and e.data.get("retention")),
        cancelled_anyway=sum(1 for e in events if e.type == "cancelled" and e.actor != "stripe"),
    )


def tenure_label(member_since: str, ended: date) -> str:
    """"2026-03" → "7 months"."""
    year, month = (int(part) for part in member_since.split("-")[:2])
    months = max(1, (ended.year - year) * 12 + ended.month - month)
    return f"{months} month{'s' if months != 1 else ''}"


def boxes_due_next_round(open_orders: list[Order], subscriptions: list[Subscription], today: date) -> Counter[tuple[str, str]]:
    """(box, cadence) → boxes to pack soon: charged-but-unpacked orders, plus active
    subscriptions whose next box is charged within NEXT_ROUND_DAYS."""
    horizon = (today + timedelta(days=NEXT_ROUND_DAYS)).isoformat()
    due: Counter[tuple[str, str]] = Counter((order.box_id, order.cadence) for order in open_orders if order.status == "topack")
    for sub in active(subscriptions):
        if sub.next_delivery and sub.next_delivery <= horizon:
            due[(sub.box_id, sub.cadence)] += 1
    return due


def stock_needed(due: Counter[tuple[str, str]], catalog: Catalog) -> Counter[str]:
    """Item id → units needed for the boxes due."""
    needed: Counter[str] = Counter()
    for (box_id, cadence), count in due.items():
        for item in catalog.get(box_id).items_for(cadence):  # type: ignore[arg-type]
            needed[item.id] += count
    return needed


def reorder_quantity(stock: int, needed: int) -> int:
    """Enough for two rounds, and never less than one round."""
    return max(needed * 2 - stock, needed, 1)
