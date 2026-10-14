from dataclasses import dataclass, field
from datetime import datetime

from modules.billing.gateway import Address, CheckoutRequest, StripeSubscriptionInfo


@dataclass
class FakeGateway:
    """Records what would have been sent to Stripe."""

    subscriptions: dict[str, StripeSubscriptionInfo] = field(default_factory=dict)
    calls: list[tuple] = field(default_factory=list)
    has_saved_card: bool = True

    def create_customer(self, uid: str, email: str) -> str:
        self.calls.append(("create_customer", uid))
        return f"cus_{uid}"

    def create_checkout_session(self, request: CheckoutRequest) -> str:
        self.calls.append(("checkout", request))
        return "https://checkout.stripe.test/session"

    def get_subscription(self, stripe_subscription_id: str) -> StripeSubscriptionInfo:
        return self.subscriptions[stripe_subscription_id]

    def set_next_charge(self, stripe_subscription_id: str, charge_at: datetime) -> None:
        self.calls.append(("set_next_charge", stripe_subscription_id, charge_at.date().isoformat()))

    def switch_price(self, stripe_subscription_id: str, price_lookup_key: str) -> None:
        self.calls.append(("switch_price", stripe_subscription_id, price_lookup_key))

    def set_cancel_at_period_end(self, stripe_subscription_id: str, cancel: bool) -> None:
        self.calls.append(("cancel_at_period_end", stripe_subscription_id, cancel))

    def start_subscription(self, previous_stripe_subscription_id, price_lookup_key, charge_at, metadata) -> str:
        if not self.has_saved_card:
            raise LookupError("no card")
        self.calls.append(("start_subscription", price_lookup_key, charge_at.date().isoformat()))
        return "sub_restarted"

    def refund_invoice(self, invoice_id: str) -> None:
        self.calls.append(("refund", invoice_id))

    def refund_payment(self, payment_intent_id: str) -> None:
        self.calls.append(("refund_payment", payment_intent_id))

    def sync_box_prices(self, box_id: str, name: str, prices_pence: dict[str, int]) -> list[str]:
        self.calls.append(("sync_prices", box_id, dict(prices_pence)))
        return list(prices_pence)

    def parse_webhook(self, payload, signature):
        raise NotImplementedError

    def add_stripe_subscription(self, stripe_id: str, metadata: dict[str, str]) -> None:
        shipping = Address(name="Maya Okafor", line1="1 Harbour Rd", line2=None, city="Bristol", postal_code="BS1 1AA", country="GB")
        self.subscriptions[stripe_id] = StripeSubscriptionInfo(id=stripe_id, customer_id="cus_maya", metadata=metadata, shipping=shipping)
