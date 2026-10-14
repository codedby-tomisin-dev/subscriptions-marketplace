"""Everything that talks to Stripe. The only module that imports `stripe`.

Services depend on the `BillingGateway` protocol and get plain dataclasses back,
so tests swap in a fake and nothing else needs to know Stripe's object shapes.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal, Protocol

import stripe

from modules.catalog.catalog import CURRENCY, ONE_OFF, price_lookup_key



@dataclass(frozen=True)
class Address:
    name: str | None
    line1: str
    line2: str | None
    city: str
    postal_code: str
    country: str


@dataclass(frozen=True)
class StripeSubscriptionInfo:
    id: str
    customer_id: str
    metadata: dict[str, str]
    shipping: Address | None


@dataclass(frozen=True)
class CheckoutCompleted:
    uid: str
    stripe_customer_id: str
    stripe_subscription_id: str
    shipping: Address | None


@dataclass(frozen=True)
class OneOffPaid:
    """A one-off box paid through Checkout (payment mode). Its payment intent keys our records."""

    session_id: str
    uid: str
    stripe_customer_id: str
    payment_intent_id: str
    amount_pence: int
    metadata: dict[str, str]
    shipping: Address | None


@dataclass(frozen=True)
class InvoicePaid:
    invoice_id: str
    stripe_subscription_id: str
    amount_pence: int


@dataclass(frozen=True)
class InvoiceFailed:
    invoice_id: str
    stripe_subscription_id: str
    amount_pence: int
    attempt_count: int
    next_retry_at: str | None


@dataclass(frozen=True)
class SubscriptionEnded:
    stripe_subscription_id: str


@dataclass(frozen=True)
class IgnoredEvent:
    type: str


BillingEvent = CheckoutCompleted | OneOffPaid | InvoicePaid | InvoiceFailed | SubscriptionEnded | IgnoredEvent


@dataclass(frozen=True)
class CheckoutRequest:
    stripe_customer_id: str
    price_lookup_key: str
    success_url: str
    cancel_url: str
    uid: str
    # Copied onto the Stripe subscription (or the one-off payment), so webhooks can build our record from it.
    metadata: dict[str, str] = field(default_factory=dict)
    # "payment" for a one-off box: one charge, no subscription.
    mode: Literal["subscription", "payment"] = "subscription"


class BillingGateway(Protocol):
    def create_customer(self, uid: str, email: str) -> str: ...

    def create_checkout_session(self, request: CheckoutRequest) -> str: ...

    def get_subscription(self, stripe_subscription_id: str) -> StripeSubscriptionInfo: ...

    def set_next_charge(self, stripe_subscription_id: str, charge_at: datetime) -> None: ...

    def switch_price(self, stripe_subscription_id: str, price_lookup_key: str) -> None: ...

    def set_cancel_at_period_end(self, stripe_subscription_id: str, cancel: bool) -> None: ...

    def start_subscription(
        self, previous_stripe_subscription_id: str, price_lookup_key: str, charge_at: datetime, metadata: dict[str, str]
    ) -> str: ...

    def refund_invoice(self, invoice_id: str) -> None: ...

    def refund_payment(self, payment_intent_id: str) -> None: ...

    def sync_box_prices(self, box_id: str, name: str, prices_pence: dict[str, int]) -> list[str]: ...

    def parse_webhook(self, payload: bytes, signature: str | None) -> BillingEvent: ...


# Stripe needs a trial end a little in the future; anything sooner is charged straight away.
_MIN_LEAD_SECONDS = 120


def _trial_end(charge_at: datetime) -> int | str:
    seconds = int(charge_at.timestamp())
    return "now" if seconds - datetime.now(timezone.utc).timestamp() < _MIN_LEAD_SECONDS else seconds


def _address(name: str | None, address: dict | None) -> Address | None:
    if not address:
        return None
    return Address(
        name=name,
        line1=address.get("line1") or "",
        line2=address.get("line2"),
        city=address.get("city") or "",
        postal_code=address.get("postal_code") or "",
        country=address.get("country") or "",
    )


def _invoice_subscription_id(invoice: dict) -> str | None:
    details = (invoice.get("parent") or {}).get("subscription_details") or {}
    subscription = details.get("subscription")
    return subscription if isinstance(subscription, str) else (subscription or {}).get("id")


class StripeGateway:
    def __init__(self, secret_key: str, webhook_secret: str = "") -> None:
        if not secret_key:
            raise RuntimeError("STRIPE_SECRET_KEY is not set in functions/.env.")
        self._client = stripe.StripeClient(secret_key)
        self._webhook_secret = webhook_secret

    def _price_id(self, lookup_key: str) -> str:
        prices = self._client.v1.prices.list(params={"lookup_keys": [lookup_key], "active": True, "limit": 1})
        if not prices.data:
            raise RuntimeError(f"No Stripe price with lookup key '{lookup_key}'. Run scripts/seed_stripe.py.")
        return prices.data[0].id

    def create_customer(self, uid: str, email: str) -> str:
        customer = self._client.v1.customers.create(params={"email": email, "metadata": {"uid": uid}})
        return customer.id

    def create_checkout_session(self, request: CheckoutRequest) -> str:
        params = {
            "mode": request.mode,
            "customer": request.stripe_customer_id,
            "client_reference_id": request.uid,
            "line_items": [{"price": self._price_id(request.price_lookup_key), "quantity": 1}],
            "shipping_address_collection": {"allowed_countries": ["GB"]},
            # Saves the shipping address on the Stripe customer, so webhooks can read it in any order.
            "customer_update": {"shipping": "auto", "name": "auto"},
            "metadata": request.metadata,
            "success_url": request.success_url,
            "cancel_url": request.cancel_url,
        }
        if request.mode == "subscription":
            params["subscription_data"] = {"metadata": request.metadata}
        else:
            params["payment_intent_data"] = {"metadata": request.metadata}
        session = self._client.v1.checkout.sessions.create(params=params)
        if not session.url:
            raise RuntimeError("Stripe returned a checkout session without a URL")
        return session.url

    def get_subscription(self, stripe_subscription_id: str) -> StripeSubscriptionInfo:
        subscription = self._client.v1.subscriptions.retrieve(stripe_subscription_id, params={"expand": ["customer"]})
        customer = subscription.customer
        shipping = customer.shipping.to_dict() if getattr(customer, "shipping", None) else {}
        return StripeSubscriptionInfo(
            id=subscription.id,
            customer_id=customer.id,
            metadata=subscription.metadata.to_dict() if subscription.metadata else {},
            shipping=_address(shipping.get("name"), shipping.get("address")),
        )

    def set_next_charge(self, stripe_subscription_id: str, charge_at: datetime) -> None:
        self._client.v1.subscriptions.update(
            stripe_subscription_id, params={"trial_end": _trial_end(charge_at), "proration_behavior": "none"}
        )

    def switch_price(self, stripe_subscription_id: str, price_lookup_key: str) -> None:
        subscription = self._client.v1.subscriptions.retrieve(stripe_subscription_id)
        item_id = subscription["items"].data[0].id
        self._client.v1.subscriptions.update(
            stripe_subscription_id,
            params={"items": [{"id": item_id, "price": self._price_id(price_lookup_key)}], "proration_behavior": "none"},
        )

    def set_cancel_at_period_end(self, stripe_subscription_id: str, cancel: bool) -> None:
        self._client.v1.subscriptions.update(stripe_subscription_id, params={"cancel_at_period_end": cancel})

    def start_subscription(
        self, previous_stripe_subscription_id: str, price_lookup_key: str, charge_at: datetime, metadata: dict[str, str]
    ) -> str:
        previous = self._client.v1.subscriptions.retrieve(previous_stripe_subscription_id)
        payment_method = previous.default_payment_method
        if not payment_method:
            raise LookupError("No saved card for this subscription")
        subscription = self._client.v1.subscriptions.create(
            params={
                "customer": previous.customer if isinstance(previous.customer, str) else previous.customer.id,
                "items": [{"price": self._price_id(price_lookup_key)}],
                "default_payment_method": payment_method if isinstance(payment_method, str) else payment_method.id,
                "trial_end": _trial_end(charge_at),
                "proration_behavior": "none",
                "metadata": metadata,
            }
        )
        return subscription.id

    def refund_invoice(self, invoice_id: str) -> None:
        payments = self._client.v1.invoice_payments.list(params={"invoice": invoice_id, "status": "paid"})
        intent = next((payment.payment.payment_intent for payment in payments.data if payment.payment.payment_intent), None)
        if not intent:
            raise LookupError("No card payment found for this order")
        self._client.v1.refunds.create(params={"payment_intent": intent if isinstance(intent, str) else intent.id})

    def refund_payment(self, payment_intent_id: str) -> None:
        self._client.v1.refunds.create(params={"payment_intent": payment_intent_id})

    def sync_box_prices(self, box_id: str, name: str, prices_pence: dict[str, int]) -> list[str]:
        """Makes the box's Stripe product and lookup-keyed prices match. Returns the options that got a new price.

        Stripe prices can't be edited, so a changed amount is a new price that takes over
        the lookup key. Existing subscriptions stay on the price they were created with.
        """
        product_id = f"bonbon_{box_id}"
        try:
            self._client.v1.products.update(product_id, params={"name": f"{name} box", "active": True})
        except stripe.InvalidRequestError:
            self._client.v1.products.create(params={"id": product_id, "name": f"{name} box"})

        changed = []
        for option, amount in prices_pence.items():
            lookup_key = price_lookup_key(box_id, option)  # type: ignore[arg-type]
            current = self._client.v1.prices.list(params={"lookup_keys": [lookup_key], "active": True, "limit": 1}).data
            if current and current[0].unit_amount == amount and current[0].currency == CURRENCY:
                continue
            params = {
                "product": product_id,
                "currency": CURRENCY,
                "unit_amount": amount,
                "lookup_key": lookup_key,
                "transfer_lookup_key": True,
            }
            if option != ONE_OFF:
                params["recurring"] = {"interval": option}
            self._client.v1.prices.create(params=params)
            changed.append(option)
        return changed

    def parse_webhook(self, payload: bytes, signature: str | None) -> BillingEvent:
        """Verifies the signature (raises ValueError if it's wrong) and maps the event."""
        try:
            event = self._client.construct_event(payload, signature, self._webhook_secret)
        except stripe.SignatureVerificationError as exc:
            raise ValueError("Invalid Stripe signature") from exc
        obj = event.data.object.to_dict()
        match event.type:
            case "checkout.session.completed" if obj.get("mode") == "subscription":
                details = (obj.get("collected_information") or {}).get("shipping_details") or {}
                return CheckoutCompleted(
                    uid=obj["client_reference_id"],
                    stripe_customer_id=obj["customer"],
                    stripe_subscription_id=obj["subscription"],
                    shipping=_address(details.get("name"), details.get("address")),
                )
            case "checkout.session.completed" if obj.get("mode") == "payment" and obj.get("payment_status") == "paid":
                details = (obj.get("collected_information") or {}).get("shipping_details") or {}
                intent = obj.get("payment_intent")
                return OneOffPaid(
                    session_id=obj["id"],
                    uid=obj["client_reference_id"],
                    stripe_customer_id=obj["customer"],
                    payment_intent_id=intent if isinstance(intent, str) else (intent or {}).get("id", ""),
                    amount_pence=obj.get("amount_total") or 0,
                    metadata=obj.get("metadata") or {},
                    shipping=_address(details.get("name"), details.get("address")),
                )
            case "invoice.paid" if _invoice_subscription_id(obj) and obj["amount_paid"] > 0:
                return InvoicePaid(obj["id"], _invoice_subscription_id(obj), obj["amount_paid"])
            case "invoice.payment_failed" if _invoice_subscription_id(obj):
                retry = obj.get("next_payment_attempt")
                return InvoiceFailed(
                    invoice_id=obj["id"],
                    stripe_subscription_id=_invoice_subscription_id(obj),
                    amount_pence=obj["amount_due"],
                    attempt_count=obj.get("attempt_count") or 1,
                    next_retry_at=datetime.fromtimestamp(retry, timezone.utc).isoformat() if retry else None,
                )
            case "customer.subscription.deleted":
                return SubscriptionEnded(obj["id"])
            case _:
                return IgnoredEvent(event.type)
