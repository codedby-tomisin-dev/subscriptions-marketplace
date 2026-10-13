from typing import Literal

from modules.catalog.catalog import Cadence
from modules.shared.document import Document
from modules.subscriptions.models import SubscriptionStatus

OverallStatus = Literal["active", "paused", "cancelled", "none"]


class ShippingAddress(Document):
    line1: str
    line2: str | None = None
    city: str
    postal_code: str
    country: str


class SubscriptionSummary(Document):
    box_id: str
    cadence: Cadence
    status: SubscriptionStatus


class Customer(Document):
    """`customers/{uid}`. The summary fields are copied from the customer's
    subscriptions on every change so the admin list needs one read per row."""

    id: str
    email: str
    name: str | None = None
    city: str | None = None
    shipping_address: ShippingAddress | None = None
    member_since: str
    ltv_pence: int = 0
    stripe_customer_id: str | None = None
    subscription_summary: list[SubscriptionSummary] = []
    next_delivery: str | None = None
    overall_status: OverallStatus = "none"
    created_at: str
    updated_at: str
