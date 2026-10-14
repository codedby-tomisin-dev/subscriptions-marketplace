from datetime import date

import pytest

from modules.billing.gateway import CheckoutCompleted, InvoiceFailed, InvoicePaid, OneOffPaid, SubscriptionEnded
from modules.billing.repository import BillingRepository
from modules.billing.service import BillingService
from modules.catalog.catalog import Catalog, starter_boxes
from modules.customers.repository import CustomersRepository
from modules.fulfilment.repository import OrdersRepository
from modules.shared.errors import FailedPrecondition
from modules.subscriptions.repository import SubscriptionsRepository
from modules.subscriptions.service import SubscriptionService
from tests.fakes import FakeGateway

TODAY = date(2026, 10, 12)  # Monday; first delivery slots are Thu 15, Fri 16, Mon 19, Tue 20


@pytest.fixture
def gateway():
    return FakeGateway()


def catalog_with_one_offs() -> Catalog:
    """The starter boxes, plus snacks sold one-off too and date night sold only one-off."""
    boxes = []
    for box in starter_boxes():
        if box.id == "snacks":
            box = box.model_copy(update={"prices": {**box.prices, "once": 2500}, "plan_notes": {**box.plan_notes, "once": "The full drawer, once"}})
        if box.id == "datenight":
            box = box.model_copy(update={"prices": {"once": 4500}, "plan_notes": {"once": "One perfect evening"}})
        boxes.append(box)
    return Catalog(boxes)


@pytest.fixture
def services(db, gateway):
    customers = CustomersRepository(db)
    subscriptions = SubscriptionsRepository(db, customers)
    catalog = catalog_with_one_offs()
    billing = BillingService(
        gateway=lambda: gateway,
        catalog=lambda: catalog,
        customers=customers,
        subscriptions=subscriptions,
        orders=OrdersRepository(db),
        billing=BillingRepository(db),
    )
    return billing, SubscriptionService(subscriptions, lambda: gateway, lambda: catalog), db


def checkout(billing: BillingService, gateway: FakeGateway, box_id="snacks", option="week", first="2026-10-15") -> str:
    """Starts checkout and simulates Stripe creating the subscription. Returns our subscription id."""
    billing.start_checkout(
        uid="maya", email="maya@example.com", box_id=box_id, option=option,
        first_delivery=date.fromisoformat(first), is_gift=False, today=TODAY, app_url="http://app",
    )
    request = next(call[1] for call in gateway.calls if call[0] == "checkout")
    gateway.add_stripe_subscription("sub_1", request.metadata)
    return request.metadata["subscriptionId"]


def doc(db, path: str) -> dict:
    return db.document(path).get().to_dict()


def test_checkout_prices_from_the_catalog_and_rejects_unknown_dates(services, gateway):
    billing, _, _ = services
    checkout(billing, gateway)
    request = next(call[1] for call in gateway.calls if call[0] == "checkout")
    assert request.price_lookup_key == "snacks_week"
    assert request.success_url.startswith("http://app/boxes/snacks?checkout=")

    with pytest.raises(ValueError):
        billing.start_checkout(
            uid="maya", email="maya@example.com", box_id="snacks", option="week",
            first_delivery=date(2026, 10, 13), is_gift=False, today=TODAY, app_url="http://app",
        )


def test_first_payment_creates_one_order_even_when_stripe_retries(services, gateway):
    billing, _, db = services
    subscription_id = checkout(billing, gateway)
    # invoice.paid can arrive before checkout.session.completed.
    paid = InvoicePaid("in_1", "sub_1", 1200)
    billing.handle_event(paid, TODAY)
    billing.handle_event(CheckoutCompleted("maya", "cus_maya", "sub_1", None), TODAY)
    billing.handle_event(paid, TODAY)

    orders = list(db.collection("orders").stream())
    assert [order.id for order in orders] == ["BB-20450"]
    order = orders[0].to_dict()
    assert order["deliveryDate"] == "2026-10-15"
    assert order["shipDate"] == "2026-10-14"
    assert order["customerName"] == "Maya Okafor"
    assert order["city"] == "Bristol"
    assert order["items"] == ["Sea salt chocolate", "Hand-cooked crisps", "Brown butter cookies"]

    subscription = doc(db, f"subscriptions/{subscription_id}")
    assert subscription["packedDelivery"] == "2026-10-15"
    assert subscription["nextDelivery"] == "2026-10-22"

    customer = doc(db, "customers/maya")
    assert customer["ltvPence"] == 1200
    assert customer["overallStatus"] == "active"
    assert customer["nextDelivery"] == "2026-10-15"
    # The next charge is three days before the following box.
    assert ("set_next_charge", "sub_1", "2026-10-19") in gateway.calls


def test_second_payment_takes_the_next_order_number(services, gateway):
    billing, _, db = services
    checkout(billing, gateway)
    billing.handle_event(InvoicePaid("in_1", "sub_1", 1200), TODAY)
    billing.handle_event(InvoicePaid("in_2", "sub_1", 1200), TODAY)
    assert sorted(order.id for order in db.collection("orders").stream()) == ["BB-20450", "BB-20451"]
    assert doc(db, "customers/maya")["ltvPence"] == 2400


def test_customer_changes_move_stripe_billing(services, gateway):
    billing, subscriptions, db = services
    subscription_id = checkout(billing, gateway)
    billing.handle_event(InvoicePaid("in_1", "sub_1", 1200), TODAY)
    manage = lambda action, **params: subscriptions.manage(  # noqa: E731
        subscription_id=subscription_id, action=action, params=params, actor="maya", is_admin=False, today=TODAY
    )

    assert manage("skip_next").next_delivery == "2026-10-29"
    assert gateway.calls[-1] == ("set_next_charge", "sub_1", "2026-10-26")
    assert manage("unskip").next_delivery == "2026-10-22"

    manage("change_cadence", cadence="month")
    assert gateway.calls[-1] == ("switch_price", "sub_1", "snacks_month")

    cancelled = manage("cancel", reason="A bit pricey")
    assert cancelled.final_delivery == "2026-10-15"
    assert gateway.calls[-1] == ("cancel_at_period_end", "sub_1", True)
    assert manage("undo_cancel").status == "active"

    events = [event.to_dict() for event in db.collection("events").stream()]
    assert {"skipped", "unskipped", "cadence_changed", "cancelled", "cancel_undone"} <= {event["type"] for event in events}
    reason = next(event for event in events if event["type"] == "cancelled")["data"]["reason"]
    assert reason == "A bit pricey"


def test_customers_cant_touch_other_peoples_subscriptions_but_admins_can(services, gateway):
    billing, subscriptions, _ = services
    subscription_id = checkout(billing, gateway)
    billing.handle_event(InvoicePaid("in_1", "sub_1", 1200), TODAY)

    with pytest.raises(KeyError):
        subscriptions.manage(subscription_id=subscription_id, action="pause", params={}, actor="sam", is_admin=False, today=TODAY)
    paused = subscriptions.manage(subscription_id=subscription_id, action="pause", params={}, actor="ops", is_admin=True, today=TODAY)
    assert paused.status == "paused"


def test_failed_payment_flags_the_subscription(services, gateway):
    billing, _, db = services
    subscription_id = checkout(billing, gateway)
    billing.handle_event(InvoiceFailed("in_1", "sub_1", 1200, 2, "2026-10-14T06:00:00+00:00"), TODAY)
    assert doc(db, f"subscriptions/{subscription_id}")["paymentFailed"] is True
    assert doc(db, "payments/in_1")["status"] == "failed"

    billing.handle_event(InvoicePaid("in_1", "sub_1", 1200), TODAY)
    assert doc(db, f"subscriptions/{subscription_id}")["paymentFailed"] is False
    assert doc(db, "payments/in_1")["status"] == "paid"


def test_stripe_ending_billing_finalises_a_pending_cancel(services, gateway):
    billing, subscriptions, db = services
    subscription_id = checkout(billing, gateway)
    billing.handle_event(InvoicePaid("in_1", "sub_1", 1200), TODAY)
    subscriptions.manage(subscription_id=subscription_id, action="cancel", params={}, actor="maya", is_admin=False, today=TODAY)
    billing.handle_event(SubscriptionEnded("sub_1"), TODAY)

    assert doc(db, f"subscriptions/{subscription_id}")["beforeCancel"] is None
    restarted = subscriptions.manage(subscription_id=subscription_id, action="restart", params={}, actor="maya", is_admin=False, today=TODAY)
    assert restarted.stripe_subscription_id == "sub_restarted"
    assert gateway.calls[-1] == ("start_subscription", "snacks_week", "2026-10-12")


def test_restart_without_a_saved_card_asks_for_checkout(services, gateway):
    billing, subscriptions, _ = services
    subscription_id = checkout(billing, gateway)
    billing.handle_event(CheckoutCompleted("maya", "cus_maya", "sub_1", None), TODAY)
    subscriptions.manage(subscription_id=subscription_id, action="cancel", params={}, actor="maya", is_admin=False, today=TODAY)
    billing.handle_event(SubscriptionEnded("sub_1"), TODAY)
    gateway.has_saved_card = False
    with pytest.raises(FailedPrecondition):
        subscriptions.manage(subscription_id=subscription_id, action="restart", params={}, actor="maya", is_admin=False, today=TODAY)


def test_refund_marks_order_and_payment_and_reduces_lifetime_value(services, gateway):
    billing, _, db = services
    subscription_id = checkout(billing, gateway)
    billing.handle_event(InvoicePaid("in_1", "sub_1", 1200), TODAY)

    billing.refund_order(order_id="BB-20450", actor="ops")
    assert ("refund", "in_1") in gateway.calls
    assert doc(db, "orders/BB-20450")["status"] == "refunded"
    assert doc(db, "payments/in_1")["status"] == "refunded"
    assert doc(db, "customers/maya")["ltvPence"] == 0
    assert doc(db, f"subscriptions/{subscription_id}")["packedDelivery"] is None
    with pytest.raises(FailedPrecondition):
        billing.refund_order(order_id="BB-20450", actor="ops")


def buy_once(billing: BillingService, gateway: FakeGateway, box_id="snacks", gift=False) -> OneOffPaid:
    """Starts a one-off checkout and returns the webhook Stripe would send once it's paid."""
    billing.start_checkout(
        uid="maya", email="maya@example.com", box_id=box_id, option="once",
        first_delivery=date(2026, 10, 16), is_gift=gift, today=TODAY, app_url="http://app",
    )
    request = [call[1] for call in gateway.calls if call[0] == "checkout"][-1]
    assert request.mode == "payment"
    assert request.price_lookup_key == f"{box_id}_once"
    assert request.success_url == f"http://app/boxes/{box_id}?bought=2026-10-16"
    return OneOffPaid("cs_1", "maya", "cus_maya", "pi_1", 2500, request.metadata, None)


def test_a_one_off_box_becomes_one_order_with_no_subscription(services, gateway):
    billing, _, db = services
    paid = buy_once(billing, gateway, gift=True)
    billing.handle_event(paid, TODAY)
    billing.handle_event(paid, TODAY)  # Stripe retries

    orders = [order.to_dict() for order in db.collection("orders").stream()]
    assert len(orders) == 1
    order = orders[0]
    assert order["cadence"] == "once" and order["subscriptionId"] is None and order["isGift"] is True
    assert order["deliveryDate"] == "2026-10-16" and order["shipDate"] == "2026-10-15"
    # A one-off box is the full box, like monthly.
    assert len(order["items"]) == len(next(box for box in starter_boxes() if box.id == "snacks").items)
    assert order["stripePaymentIntentId"] == "pi_1"
    assert doc(db, "payments/pi_1")["status"] == "paid"
    assert doc(db, "customers/maya")["ltvPence"] == 2500
    assert list(db.collection("subscriptions").stream()) == []
    assert [event.to_dict()["type"] for event in db.collection("events").stream()] == ["one_off_bought"]


def test_refunding_a_one_off_box_refunds_its_payment(services, gateway):
    billing, _, db = services
    billing.handle_event(buy_once(billing, gateway), TODAY)

    billing.refund_order(order_id="BB-20450", actor="ops")
    assert ("refund_payment", "pi_1") in gateway.calls
    assert doc(db, "orders/BB-20450")["status"] == "refunded"
    assert doc(db, "payments/pi_1")["status"] == "refunded"
    assert doc(db, "customers/maya")["ltvPence"] == 0


def test_only_the_ways_a_box_is_sold_can_be_bought(services, gateway):
    billing, subscriptions, _ = services
    buy_once(billing, gateway, box_id="datenight")
    with pytest.raises(FailedPrecondition, match="isn’t sold weekly"):
        checkout(billing, gateway, box_id="datenight")
    with pytest.raises(FailedPrecondition, match="isn’t sold one-off"):
        billing.start_checkout(
            uid="maya", email="maya@example.com", box_id="selfcare", option="once",
            first_delivery=date(2026, 10, 16), is_gift=False, today=TODAY, app_url="http://app",
        )


def test_subscribers_cant_switch_to_a_cadence_no_longer_sold(db, gateway):
    customers = CustomersRepository(db)
    subscriptions = SubscriptionsRepository(db, customers)
    boxes = Catalog(starter_boxes())
    billing = BillingService(
        gateway=lambda: gateway, catalog=lambda: boxes, customers=customers, subscriptions=subscriptions,
        orders=OrdersRepository(db), billing=BillingRepository(db),
    )
    subscription_id = checkout(billing, gateway)
    billing.handle_event(InvoicePaid("in_1", "sub_1", 1200), TODAY)
    snacks = boxes.get("snacks")
    weekly_only = Catalog([snacks.model_copy(update={"prices": {"week": 1200}, "plan_notes": {"week": "x"}})])
    service = SubscriptionService(subscriptions, lambda: gateway, lambda: weekly_only)
    with pytest.raises(FailedPrecondition, match="isn’t sold monthly"):
        service.manage(subscription_id=subscription_id, action="change_cadence", params={"cadence": "month"}, actor="maya", is_admin=False, today=TODAY)
