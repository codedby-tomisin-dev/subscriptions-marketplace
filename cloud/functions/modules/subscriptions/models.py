from typing import Literal

from modules.catalog.catalog import Cadence
from modules.shared.document import Document

SubscriptionStatus = Literal["active", "paused", "cancelled"]


class ScheduleSnapshot(Document):
    """What a subscription looked like before it was cancelled, so the cancel can be undone."""

    status: SubscriptionStatus
    next_delivery: str | None
    resumes_on: str | None = None


class Subscription(Document):
    """`subscriptions/{id}`. Dates are ISO strings; months are "YYYY-MM"."""

    id: str
    customer_id: str
    box_id: str
    cadence: Cadence
    status: SubscriptionStatus
    # The next box that hasn't been charged yet. Skip, pause and cadence changes move this one.
    next_delivery: str | None
    # A box that's been charged and is being packed or is on its way.
    packed_delivery: str | None = None
    resumes_on: str | None = None
    member_since: str
    ended_on: str | None = None
    final_delivery: str | None = None
    is_gift: bool = False
    # What this subscriber pays per box. Fixed when they subscribe or switch cadence,
    # so later catalog price changes only apply to new subscribers.
    price_pence: int | None = None
    # The delivery the last skip jumped over, so it can be undone.
    skipped_delivery: str | None = None
    before_cancel: ScheduleSnapshot | None = None
    payment_failed: bool = False
    monthly_value_pence: int
    stripe_subscription_id: str | None = None
    created_at: str
    updated_at: str


EventType = Literal[
    "subscription_created",
    "cadence_changed",
    "skipped",
    "unskipped",
    "paused",
    "resumed",
    "cancelled",
    "cancel_undone",
    "restarted",
    "payment_paid",
    "payment_failed",
    "refunded",
    "order_delivered",
    "one_off_bought",
]


class Event(Document):
    """`events/{id}`: the audit trail behind the subscriber drawer and cancellation analytics."""

    id: str | None = None
    customer_id: str
    subscription_id: str | None = None
    type: EventType
    # The uid of whoever acted; "stripe" or "system" for automatic changes.
    actor: str
    data: dict = {}
    at: str
