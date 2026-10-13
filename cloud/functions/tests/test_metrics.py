from collections import Counter
from datetime import date

from modules.analytics import metrics
from modules.catalog.catalog import Catalog, starter_boxes
from modules.fulfilment.models import Order
from modules.subscriptions.models import Event, Subscription

TODAY = date(2026, 10, 12)


def sub(box_id="snacks", cadence="week", status="active", next_delivery="2026-10-15", value=5200) -> Subscription:
    return Subscription(
        id=f"{box_id}-{cadence}-{status}", customer_id="c", box_id=box_id, cadence=cadence, status=status,
        next_delivery=next_delivery, member_since="2026-01", monthly_value_pence=value, created_at="x", updated_at="x",
    )


def event(kind: str, actor="c", at="2026-10-10T09:00:00+00:00", subscription_id="s1", **data) -> Event:
    return Event(customer_id="c", subscription_id=subscription_id, type=kind, actor=actor, data=data, at=at)


def test_mrr_counts_active_subscriptions_with_weekly_normalised():
    subs = [sub(value=5200), sub(box_id="datenight", cadence="month", value=3900), sub(status="paused", value=9999)]
    assert metrics.monthly_recurring_revenue_pence(subs) == 9100
    assert metrics.mrr_by_box(subs, ["snacks", "datenight", "home"])[0] == {"boxId": "snacks", "mrrPence": 5200}
    assert {"boxId": "home", "mrrPence": 0} in metrics.mrr_by_box(subs, ["snacks", "datenight", "home"])


def test_churn_rate():
    assert metrics.churn_rate(active_now=97, cancelled_in_period=3) == 0.03
    assert metrics.churn_rate(0, 0) == 0.0


def test_reason_shares_bucket_unknown_reasons():
    shares = metrics.reason_shares([event("cancelled", reason="A bit pricey"), event("cancelled", reason=None), event("cancelled", reason="A bit pricey")])
    assert shares[0] == {"reason": "A bit pricey", "percent": 67}
    assert {"reason": "Something else", "percent": 33} in shares


def test_save_rate_ignores_non_retention_changes_and_stripe_cancels():
    rate = metrics.save_rate([
        event("paused", retention=True), event("paused", retention=False),
        event("cadence_changed", retention=True), event("cancelled"), event("cancelled", actor="stripe"),
    ])
    assert (rate.paused_instead, rate.switched_to_monthly, rate.cancelled_anyway) == (1, 1, 1)
    assert rate.percent_saved == 67


def test_next_round_counts_unpacked_orders_and_soon_charged_subscriptions():
    order = Order(
        id="BB-1", customer_id="c", customer_name="", city="", subscription_id="s", box_id="snacks", cadence="month",
        delivery_date="2026-10-14", ship_date="2026-10-13", status="topack", price_pence=2600, placed_on="x", created_at="x", updated_at="x",
    )
    due = metrics.boxes_due_next_round([order], [sub(next_delivery="2026-10-15"), sub(next_delivery="2026-11-30")], TODAY)
    assert due == Counter({("snacks", "month"): 1, ("snacks", "week"): 1})
    needed = metrics.stock_needed(due, Catalog(starter_boxes()))
    assert needed["snacks-chocolate"] == 2
    assert needed["snacks-nuts"] == 1  # monthly only


def test_reorder_covers_two_rounds():
    assert metrics.reorder_quantity(stock=46, needed=128) == 210
    assert metrics.reorder_quantity(stock=500, needed=10) == 10


def test_tenure_label():
    assert metrics.tenure_label("2026-04", date(2026, 10, 11)) == "6 months"
    assert metrics.tenure_label("2026-10", date(2026, 10, 11)) == "1 month"


def test_undone_cancellations_dont_count():
    events = [
        event("cancelled", at="2026-10-01T09:00:00+00:00", reason="A bit pricey"),
        event("cancel_undone", at="2026-10-01T09:05:00+00:00"),
        event("cancelled", at="2026-10-05T09:00:00+00:00", reason="Too many boxes"),
        event("cancelled", at="2026-10-06T09:00:00+00:00", subscription_id="s2"),
    ]
    kept = metrics.effective_cancellations(events)
    assert [(e.subscription_id, e.data.get("reason")) for e in kept] == [("s2", None), ("s1", "Too many boxes")]
