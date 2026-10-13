"""Pure subscription state changes. Mirrors app/pwa/src/features/subscriptions/lifecycle.ts,
but the server is the one that decides.

Each transition returns a `Change`: the updated subscription, the event to log and
the billing instruction that keeps Stripe in step. Nothing here does I/O.
"""
from dataclasses import dataclass
from datetime import date

from modules.catalog.catalog import Cadence, monthly_value_pence
from modules.shared.errors import FailedPrecondition
from modules.subscriptions.models import EventType, ScheduleSnapshot, Subscription
from modules.subscriptions.schedule import (
    earliest_delivery,
    following_delivery,
    iso_month,
    pause_resume_date,
)


@dataclass(frozen=True)
class ChargeFor:
    """Move the next Stripe charge to the charge date for this delivery."""

    delivery: date


@dataclass(frozen=True)
class SwitchPrice:
    cadence: Cadence


@dataclass(frozen=True)
class SetCancelAtPeriodEnd:
    cancel: bool


@dataclass(frozen=True)
class StartNewBilling:
    """The old Stripe subscription has ended; start a new one, first charged for this delivery."""

    delivery: date


BillingInstruction = ChargeFor | SwitchPrice | SetCancelAtPeriodEnd | StartNewBilling


@dataclass(frozen=True)
class Change:
    subscription: Subscription
    event_type: EventType
    event_data: dict
    billing: BillingInstruction | None


def _require_status(subscription: Subscription, *allowed: str) -> None:
    if subscription.status not in allowed:
        raise FailedPrecondition(f"This subscription is {subscription.status}.")


def _next_delivery(subscription: Subscription) -> date:
    if not subscription.next_delivery:
        raise FailedPrecondition("This subscription has no upcoming box.")
    return date.fromisoformat(subscription.next_delivery)


def change_cadence(subscription: Subscription, cadence: Cadence, *, price_pence: int, retention: bool = False) -> Change:
    """Switches rhythm at the box's current price for that cadence."""
    _require_status(subscription, "active", "paused")
    if cadence == subscription.cadence:
        raise FailedPrecondition(f"This subscription is already {cadence}ly.")
    updated = subscription.model_copy(
        update={"cadence": cadence, "price_pence": price_pence, "monthly_value_pence": monthly_value_pence(price_pence, cadence)}
    )
    return Change(updated, "cadence_changed", {"from": subscription.cadence, "to": cadence, "retention": retention}, SwitchPrice(cadence))


def skip_next(subscription: Subscription) -> Change:
    _require_status(subscription, "active")
    skipped = _next_delivery(subscription)
    following = following_delivery(skipped, subscription.cadence)
    updated = subscription.model_copy(update={"next_delivery": following.isoformat(), "skipped_delivery": skipped.isoformat()})
    return Change(updated, "skipped", {"delivery": skipped.isoformat()}, ChargeFor(following))


def undo_skip(subscription: Subscription, today: date) -> Change:
    _require_status(subscription, "active")
    if not subscription.skipped_delivery:
        raise FailedPrecondition("There's no skipped box to bring back.")
    restored = date.fromisoformat(subscription.skipped_delivery)
    if restored < earliest_delivery(today):
        raise FailedPrecondition("It's too late to bring that box back — we'd need a few days to pack it.")
    updated = subscription.model_copy(update={"next_delivery": restored.isoformat(), "skipped_delivery": None})
    return Change(updated, "unskipped", {"delivery": restored.isoformat()}, ChargeFor(restored))


def pause(subscription: Subscription, today: date, *, retention: bool = False) -> Change:
    """Pauses until the 1st of the month two months out. Billing picks up again on its own then."""
    _require_status(subscription, "active")
    resumes_on = pause_resume_date(today)
    updated = subscription.model_copy(
        update={"status": "paused", "resumes_on": resumes_on.isoformat(), "next_delivery": resumes_on.isoformat(), "skipped_delivery": None}
    )
    return Change(updated, "paused", {"resumesOn": resumes_on.isoformat(), "retention": retention}, ChargeFor(resumes_on))


def resume(subscription: Subscription, today: date) -> Change:
    _require_status(subscription, "paused")
    next_delivery = earliest_delivery(today)
    updated = subscription.model_copy(update={"status": "active", "resumes_on": None, "next_delivery": next_delivery.isoformat()})
    return Change(updated, "resumed", {"nextDelivery": next_delivery.isoformat()}, ChargeFor(next_delivery))


def cancel(subscription: Subscription, today: date, *, reason: str | None = None) -> Change:
    """Stops future charges. A box that's already been charged (`packed_delivery`) still arrives."""
    _require_status(subscription, "active", "paused")
    snapshot = ScheduleSnapshot(status=subscription.status, next_delivery=subscription.next_delivery, resumes_on=subscription.resumes_on)
    updated = subscription.model_copy(
        update={
            "status": "cancelled",
            "ended_on": iso_month(today),
            "final_delivery": subscription.packed_delivery,
            "next_delivery": None,
            "resumes_on": None,
            "skipped_delivery": None,
            "before_cancel": snapshot,
        }
    )
    return Change(updated, "cancelled", {"reason": reason, "fromStatus": subscription.status}, SetCancelAtPeriodEnd(True))


def undo_cancel(subscription: Subscription, today: date) -> Change:
    _require_status(subscription, "cancelled")
    snapshot = subscription.before_cancel
    if snapshot is None:
        raise FailedPrecondition("This subscription has fully ended. Restart it instead.")
    next_delivery = snapshot.next_delivery
    # If the old date has come too close to pack, move to the earliest we can do.
    if snapshot.status == "active" and next_delivery and date.fromisoformat(next_delivery) < earliest_delivery(today):
        next_delivery = earliest_delivery(today).isoformat()
    updated = subscription.model_copy(
        update={
            "status": snapshot.status,
            "next_delivery": next_delivery,
            "resumes_on": snapshot.resumes_on,
            "ended_on": None,
            "final_delivery": None,
            "before_cancel": None,
        }
    )
    return Change(updated, "cancel_undone", {}, SetCancelAtPeriodEnd(False))


def restart(subscription: Subscription, today: date) -> Change:
    """Restarts a subscription whose billing has ended. While the cancel can still be undone, does that instead."""
    if subscription.before_cancel is not None:
        return undo_cancel(subscription, today)
    _require_status(subscription, "cancelled")
    next_delivery = earliest_delivery(today)
    updated = subscription.model_copy(
        update={
            "status": "active",
            "next_delivery": next_delivery.isoformat(),
            "ended_on": None,
            "final_delivery": None,
            "payment_failed": False,
        }
    )
    return Change(updated, "restarted", {"nextDelivery": next_delivery.isoformat()}, StartNewBilling(next_delivery))


def record_payment(subscription: Subscription) -> Subscription:
    """A charge went through: the next box is now packed, and the schedule moves on one delivery.

    A paused subscription whose resume date has come round is charged automatically,
    which is what resumes it.
    """
    delivery = _next_delivery(subscription)
    return subscription.model_copy(
        update={
            "status": "active",
            "resumes_on": None,
            "packed_delivery": delivery.isoformat(),
            "next_delivery": following_delivery(delivery, subscription.cadence).isoformat(),
            "skipped_delivery": None,
            "payment_failed": False,
        }
    )


def record_billing_ended(subscription: Subscription, today: date) -> Subscription:
    """Stripe has ended the subscription (cancel took effect, or payment retries ran out)."""
    if subscription.status == "cancelled":
        return subscription.model_copy(update={"before_cancel": None})
    return subscription.model_copy(
        update={
            "status": "cancelled",
            "ended_on": iso_month(today),
            "final_delivery": subscription.packed_delivery,
            "next_delivery": None,
            "resumes_on": None,
            "before_cancel": None,
        }
    )
