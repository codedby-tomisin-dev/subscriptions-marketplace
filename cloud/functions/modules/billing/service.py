"""Checkout, Stripe webhooks and refunds.

Webhooks can arrive in any order and more than once. Every handler first makes
sure our subscription exists (building it from the Stripe subscription's
metadata if needed), and a paid invoice is recorded at most once, keyed by its id.

A one-off box is a single Checkout payment with no subscription: the completed
session creates its order straight away, recorded at most once by payment intent.
"""
from datetime import date
from typing import Callable

from core import telemetry
from modules.billing.gateway import (
    Address,
    BillingEvent,
    BillingGateway,
    CheckoutCompleted,
    CheckoutRequest,
    InvoiceFailed,
    InvoicePaid,
    OneOffPaid,
    SubscriptionEnded,
)
from modules.billing.repository import BillingRepository
from modules.catalog.catalog import ONE_OFF, OPTION_NAMES, Cadence, Catalog, PurchaseOption
from modules.customers.models import Customer, ShippingAddress
from modules.customers.repository import CustomersRepository
from modules.fulfilment.models import Order, Payment
from modules.fulfilment.orders import can_move, ship_date_for
from modules.fulfilment.repository import OrdersRepository
from modules.shared.clock import timestamp
from modules.shared.errors import FailedPrecondition
from modules.subscriptions import lifecycle
from modules.subscriptions.models import Event, Subscription
from modules.subscriptions.repository import SubscriptionsRepository
from modules.subscriptions.schedule import charge_time, iso_month, upcoming_delivery_dates
from modules.subscriptions.service import billing_metadata

logger = telemetry.get_logger(__name__)

STRIPE_ACTOR = "stripe"


class BillingService:
    def __init__(
        self,
        *,
        gateway: Callable[[], BillingGateway],
        catalog: Callable[[], Catalog],
        customers: CustomersRepository,
        subscriptions: SubscriptionsRepository,
        orders: OrdersRepository,
        billing: BillingRepository,
    ) -> None:
        self._gateway = gateway
        self._catalog = catalog
        self._customers = customers
        self._subscriptions = subscriptions
        self._orders = orders
        self._billing = billing

    # --- Checkout -------------------------------------------------------------------

    def start_checkout(
        self, *, uid: str, email: str, box_id: str, option: PurchaseOption, first_delivery: date, is_gift: bool, today: date, app_url: str
    ) -> str:
        """Returns the Stripe Checkout URL. The price comes from the catalog, never the client."""
        box = self._catalog().get(box_id)
        if box.status != "active":
            raise FailedPrecondition(f"{box.name} isn’t available any more.")
        if not box.offers(option):
            raise FailedPrecondition(f"The {box.name.lower()} box isn’t sold {OPTION_NAMES[option]} any more.")
        if first_delivery not in upcoming_delivery_dates(today):
            raise ValueError("Pick one of the delivery dates shown.")

        gateway = self._gateway()
        customer = self._ensure_customer(uid, email, today, gateway)
        if option == ONE_OFF:
            return gateway.create_checkout_session(
                CheckoutRequest(
                    stripe_customer_id=customer.stripe_customer_id or "",
                    price_lookup_key=box.price_lookup_key(ONE_OFF),
                    success_url=f"{app_url}/boxes/{box.id}?bought={first_delivery.isoformat()}",
                    cancel_url=f"{app_url}/boxes/{box.id}",
                    uid=uid,
                    metadata={"uid": uid, "boxId": box.id, "delivery": first_delivery.isoformat(), "isGift": "true" if is_gift else "false"},
                    mode="payment",
                )
            )

        cadence: Cadence = option  # type: ignore[assignment]
        draft = Subscription(
            id=self._subscriptions.new_id(),
            customer_id=uid,
            box_id=box.id,
            cadence=cadence,
            status="active",
            next_delivery=first_delivery.isoformat(),
            member_since=iso_month(today),
            is_gift=is_gift,
            price_pence=box.prices[cadence],
            monthly_value_pence=box.monthly_value_pence(cadence),
            created_at=timestamp(),
            updated_at=timestamp(),
        )
        return gateway.create_checkout_session(
            CheckoutRequest(
                stripe_customer_id=customer.stripe_customer_id or "",
                price_lookup_key=box.price_lookup_key(cadence),
                success_url=f"{app_url}/boxes/{box.id}?checkout={draft.id}",
                cancel_url=f"{app_url}/boxes/{box.id}",
                uid=uid,
                metadata=billing_metadata(draft, first_delivery=first_delivery),
            )
        )

    def _ensure_customer(self, uid: str, email: str, today: date, gateway: BillingGateway) -> Customer:
        customer = self._customers.find(uid)
        if customer and customer.stripe_customer_id:
            return customer
        stripe_customer_id = gateway.create_customer(uid, email)
        if customer:
            self._customers.update_fields(uid, {"stripeCustomerId": stripe_customer_id})
            return customer.model_copy(update={"stripe_customer_id": stripe_customer_id})
        now = timestamp()
        customer = Customer(
            id=uid, email=email, member_since=iso_month(today), stripe_customer_id=stripe_customer_id, created_at=now, updated_at=now
        )
        self._customers.save(customer)
        return customer

    # --- Webhooks -------------------------------------------------------------------

    def handle_event(self, event: BillingEvent, today: date) -> None:
        match event:
            case CheckoutCompleted():
                self._save_shipping(event.uid, event.shipping)
                self._ensure_subscription(event.stripe_subscription_id, today)
            case OneOffPaid():
                self._save_shipping(event.uid, event.shipping)
                self._record_one_off_paid(event, today)
            case InvoicePaid():
                self._record_invoice_paid(event, today)
            case InvoiceFailed():
                self._record_invoice_failed(event, today)
            case SubscriptionEnded():
                self._record_billing_ended(event.stripe_subscription_id, today)

    def _save_shipping(self, uid: str, shipping: Address | None) -> None:
        if not shipping:
            return
        address = ShippingAddress(
            line1=shipping.line1, line2=shipping.line2, city=shipping.city, postal_code=shipping.postal_code, country=shipping.country
        )
        fields = {"city": shipping.city, "shippingAddress": address.to_firestore()}
        if shipping.name:
            fields["name"] = shipping.name
        self._customers.update_fields(uid, fields)

    def _ensure_subscription(self, stripe_subscription_id: str, today: date) -> Subscription:
        """Our record for a Stripe subscription, created from its metadata on first sight."""
        existing = self._subscriptions.find_by_stripe_id(stripe_subscription_id)
        if existing:
            return existing

        info = self._gateway().get_subscription(stripe_subscription_id)
        metadata = info.metadata
        uid = metadata["uid"]
        customer = self._customers.find(uid)
        if info.shipping and not (customer and customer.name):
            self._save_shipping(uid, info.shipping)

        try:
            # A restart: the record exists and is being linked to a new Stripe subscription.
            linked = self._subscriptions.get(metadata["subscriptionId"])
            return self._subscriptions.save_with_event(linked.model_copy(update={"stripe_subscription_id": stripe_subscription_id}), None)
        except KeyError:
            pass

        box = self._catalog().get(metadata["boxId"])
        cadence: Cadence = metadata["cadence"]  # type: ignore[assignment]
        now = timestamp()
        subscription = Subscription(
            id=metadata["subscriptionId"],
            customer_id=uid,
            box_id=box.id,
            cadence=cadence,
            status="active",
            next_delivery=metadata["firstDelivery"],
            member_since=iso_month(today),
            is_gift=metadata.get("isGift") == "true",
            price_pence=box.prices[cadence],
            monthly_value_pence=box.monthly_value_pence(cadence),
            stripe_subscription_id=stripe_subscription_id,
            created_at=now,
            updated_at=now,
        )
        event = Event(
            customer_id=uid,
            subscription_id=subscription.id,
            type="subscription_created",
            actor=uid,
            data={"boxId": box.id, "cadence": cadence},
            at=now,
        )
        telemetry.event("subscription_created", subscription_id=subscription.id, box_id=box.id, cadence=cadence)
        return self._subscriptions.save_with_event(subscription, event)

    def _record_invoice_paid(self, paid: InvoicePaid, today: date) -> None:
        subscription = self._ensure_subscription(paid.stripe_subscription_id, today)
        gateway = self._gateway()

        recorded = self._billing.find_payment(paid.invoice_id)
        if recorded and recorded.status != "failed":
            # A retry. The order exists; just make sure Stripe's next charge matches our schedule.
            if subscription.next_delivery and subscription.status != "cancelled":
                gateway.set_next_charge(paid.stripe_subscription_id, charge_time(date.fromisoformat(subscription.next_delivery)))
            return
        if subscription.status == "cancelled" or not subscription.next_delivery:
            logger.warning("invoice %s paid for subscription %s with no upcoming box", paid.invoice_id, subscription.id)
            return

        delivery = date.fromisoformat(subscription.next_delivery)
        advanced = lifecycle.record_payment(subscription)
        customer = self._customers.find(subscription.customer_id)
        recipe = self._catalog().get(subscription.box_id).items_for(subscription.cadence)
        now = timestamp()

        def build_order(number: str) -> Order:
            return Order(
                id=number,
                customer_id=subscription.customer_id,
                customer_name=(customer.name if customer else None) or "",
                city=(customer.city if customer else None) or "",
                subscription_id=subscription.id,
                box_id=subscription.box_id,
                cadence=subscription.cadence,
                is_gift=subscription.is_gift,
                items=[item.name for item in recipe],
                delivery_date=delivery.isoformat(),
                ship_date=ship_date_for(delivery).isoformat(),
                price_pence=paid.amount_pence,
                stripe_invoice_id=paid.invoice_id,
                placed_on=today.isoformat(),
                created_at=now,
                updated_at=now,
            )

        order = self._billing.record_invoice_paid(
            invoice_id=paid.invoice_id,
            amount_pence=paid.amount_pence,
            subscription=advanced,
            build_order=build_order,
            event=Event(
                customer_id=subscription.customer_id,
                subscription_id=subscription.id,
                type="payment_paid",
                actor=STRIPE_ACTOR,
                data={"boxId": subscription.box_id, "amountPence": paid.amount_pence, "delivery": delivery.isoformat()},
                at=now,
            ),
        )
        if order is None:
            return
        self._customers.refresh_summary(subscription.customer_id, self._subscriptions.list_for_customer(subscription.customer_id))
        gateway.set_next_charge(paid.stripe_subscription_id, charge_time(date.fromisoformat(advanced.next_delivery or "")))
        telemetry.event("order_created", order_id=order.id, subscription_id=subscription.id)

    def _record_one_off_paid(self, paid: OneOffPaid, today: date) -> None:
        box = self._catalog().get(paid.metadata["boxId"])
        delivery = date.fromisoformat(paid.metadata["delivery"])
        customer = self._customers.find(paid.uid)
        now = timestamp()

        def build_order(number: str) -> Order:
            return Order(
                id=number,
                customer_id=paid.uid,
                customer_name=(customer.name if customer else None) or "",
                city=(customer.city if customer else None) or "",
                box_id=box.id,
                cadence=ONE_OFF,
                is_gift=paid.metadata.get("isGift") == "true",
                items=[item.name for item in box.items_for(ONE_OFF)],
                delivery_date=delivery.isoformat(),
                ship_date=ship_date_for(delivery).isoformat(),
                price_pence=paid.amount_pence,
                stripe_payment_intent_id=paid.payment_intent_id,
                placed_on=today.isoformat(),
                created_at=now,
                updated_at=now,
            )

        order = self._billing.record_paid_order(
            payment_id=paid.payment_intent_id,
            customer_id=paid.uid,
            amount_pence=paid.amount_pence,
            subscription=None,
            build_order=build_order,
            event=Event(
                customer_id=paid.uid,
                type="one_off_bought",
                actor=paid.uid,
                data={"boxId": box.id, "amountPence": paid.amount_pence, "delivery": delivery.isoformat()},
                at=now,
            ),
        )
        if order is not None:
            telemetry.event("order_created", order_id=order.id, box_id=box.id, one_off=True)

    def _record_invoice_failed(self, failed: InvoiceFailed, today: date) -> None:
        subscription = self._ensure_subscription(failed.stripe_subscription_id, today)
        existing = self._billing.find_payment(failed.invoice_id)
        if existing and existing.status != "failed":
            return
        now = timestamp()
        self._billing.save_payment(
            Payment(
                id=failed.invoice_id,
                customer_id=subscription.customer_id,
                subscription_id=subscription.id,
                amount_pence=failed.amount_pence,
                status="failed",
                attempt_count=failed.attempt_count,
                next_retry_at=failed.next_retry_at,
                created_at=existing.created_at if existing else now,
                updated_at=now,
            )
        )
        self._subscriptions.save_with_event(
            subscription.model_copy(update={"payment_failed": True}),
            Event(
                customer_id=subscription.customer_id,
                subscription_id=subscription.id,
                type="payment_failed",
                actor=STRIPE_ACTOR,
                data={"boxId": subscription.box_id, "amountPence": failed.amount_pence, "attempt": failed.attempt_count},
                at=now,
            ),
        )

    def _record_billing_ended(self, stripe_subscription_id: str, today: date) -> None:
        subscription = self._subscriptions.find_by_stripe_id(stripe_subscription_id)
        if subscription is None:
            return
        was_live = subscription.status != "cancelled"
        event = None
        if was_live:
            # Stripe ended it on its own, e.g. after the last payment retry failed.
            event = Event(
                customer_id=subscription.customer_id,
                subscription_id=subscription.id,
                type="cancelled",
                actor=STRIPE_ACTOR,
                data={"boxId": subscription.box_id, "reason": None, "fromStatus": subscription.status},
                at=timestamp(),
            )
        self._subscriptions.save_with_event(lifecycle.record_billing_ended(subscription, today), event)

    # --- Refunds --------------------------------------------------------------------

    def refund_order(self, *, order_id: str, actor: str) -> Order:
        order = self._orders.get(order_id)
        if not can_move(order.status, "refunded"):
            raise FailedPrecondition(f"{order.id} has already been refunded.")
        payment_id = order.stripe_invoice_id or order.stripe_payment_intent_id
        if order.stripe_invoice_id:
            self._gateway().refund_invoice(order.stripe_invoice_id)
        elif order.stripe_payment_intent_id:
            self._gateway().refund_payment(order.stripe_payment_intent_id)
        payment = self._billing.find_payment(payment_id) if payment_id else None
        if payment:
            self._billing.save_payment(payment.model_copy(update={"status": "refunded", "updated_at": timestamp()}))
        self._orders.set_statuses([order], "refunded")
        self._customers.add_to_lifetime_value(order.customer_id, -order.price_pence)

        event = Event(
            customer_id=order.customer_id,
            subscription_id=order.subscription_id,
            type="refunded",
            actor=actor,
            data={"boxId": order.box_id, "orderId": order.id, "amountPence": order.price_pence},
            at=timestamp(),
        )
        if order.subscription_id is None:  # a one-off box
            self._subscriptions.add_event(event)
            return order.model_copy(update={"status": "refunded"})

        subscription = self._subscriptions.get(order.subscription_id)
        # An unshipped box won't be sent now, so it's no longer "on its way".
        unshipped = order.status in ("topack", "packed", "labelled")
        if unshipped and subscription.packed_delivery == order.delivery_date:
            subscription = subscription.model_copy(update={"packed_delivery": None, "final_delivery": None})
        self._subscriptions.save_with_event(subscription, event)
        return order.model_copy(update={"status": "refunded"})
