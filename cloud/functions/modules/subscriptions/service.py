from datetime import date
from typing import Callable, Literal

from core import telemetry
from modules.billing.gateway import BillingGateway
from modules.catalog.catalog import Catalog, parse_cadence, price_lookup_key
from modules.shared.clock import timestamp
from modules.shared.errors import FailedPrecondition
from modules.subscriptions import lifecycle
from modules.subscriptions.lifecycle import ChargeFor, SetCancelAtPeriodEnd, StartNewBilling, SwitchPrice
from modules.subscriptions.models import Event, Subscription
from modules.subscriptions.repository import SubscriptionsRepository
from modules.subscriptions.schedule import charge_time

Action = Literal["change_cadence", "skip_next", "unskip", "pause", "resume", "cancel", "undo_cancel", "restart"]
ACTIONS: tuple[str, ...] = Action.__args__  # type: ignore[attr-defined]

_MAX_REASON_LENGTH = 80


class SubscriptionService:
    """Runs one change to one subscription for a customer or an admin, keeping Stripe in step."""

    def __init__(self, repo: SubscriptionsRepository, gateway: Callable[[], BillingGateway], catalog: Callable[[], Catalog]) -> None:
        self._repo = repo
        self._catalog = catalog
        # A factory, so Stripe is only set up when the subscription is billed through it.
        self._gateway = gateway

    def manage(self, *, subscription_id: str, action: str, params: dict, actor: str, is_admin: bool, today: date) -> Subscription:
        subscription = self._repo.get(subscription_id)
        if subscription.customer_id != actor and not is_admin:
            # Same answer as a missing doc, so ids can't be probed.
            raise KeyError("No such subscription")

        change = self._apply_rules(subscription, action, params, today)
        updated = self._sync_billing(change.subscription, change.billing)
        event = Event(
            customer_id=subscription.customer_id,
            subscription_id=subscription.id,
            type=change.event_type,
            actor=actor,
            data={"boxId": subscription.box_id, **change.event_data},
            at=timestamp(),
        )
        telemetry.event("subscription_changed", subscription_id=subscription.id, action=action, by_admin=is_admin)
        return self._repo.save_with_event(updated, event)

    def _apply_rules(self, subscription: Subscription, action: str, params: dict, today: date) -> lifecycle.Change:
        retention = bool(params.get("retention"))
        match action:
            case "change_cadence":
                cadence = parse_cadence(params.get("cadence"))
                price = self._catalog().get(subscription.box_id).prices[cadence]
                return lifecycle.change_cadence(subscription, cadence, price_pence=price, retention=retention)
            case "skip_next":
                return lifecycle.skip_next(subscription)
            case "unskip":
                return lifecycle.undo_skip(subscription, today)
            case "pause":
                return lifecycle.pause(subscription, today, retention=retention)
            case "resume":
                return lifecycle.resume(subscription, today)
            case "cancel":
                reason = params.get("reason")
                reason = str(reason)[:_MAX_REASON_LENGTH] if reason else None
                return lifecycle.cancel(subscription, today, reason=reason)
            case "undo_cancel":
                return lifecycle.undo_cancel(subscription, today)
            case "restart":
                return lifecycle.restart(subscription, today)
            case _:
                raise ValueError(f"Unknown action '{action}'")

    def _sync_billing(self, subscription: Subscription, billing: lifecycle.BillingInstruction | None) -> Subscription:
        stripe_id = subscription.stripe_subscription_id
        if billing is None or stripe_id is None:
            # Seeded demo subscriptions aren't billed through Stripe.
            return subscription

        gateway = self._gateway()
        match billing:
            case ChargeFor(delivery=delivery):
                gateway.set_next_charge(stripe_id, charge_time(delivery))
            case SwitchPrice(cadence=cadence):
                gateway.switch_price(stripe_id, price_lookup_key(subscription.box_id, cadence))
            case SetCancelAtPeriodEnd(cancel=cancel):
                gateway.set_cancel_at_period_end(stripe_id, cancel)
                if not cancel and subscription.next_delivery:
                    gateway.set_next_charge(stripe_id, charge_time(date.fromisoformat(subscription.next_delivery)))
            case StartNewBilling(delivery=delivery):
                metadata = billing_metadata(subscription, first_delivery=delivery)
                try:
                    new_id = gateway.start_subscription(
                        stripe_id, price_lookup_key(subscription.box_id, subscription.cadence), charge_time(delivery), metadata
                    )
                except LookupError:
                    raise FailedPrecondition("We don’t have a card saved for this box. Start it again from the box page.") from None
                return subscription.model_copy(update={"stripe_subscription_id": new_id})
        return subscription


def billing_metadata(subscription: Subscription, *, first_delivery: date) -> dict[str, str]:
    """Stored on the Stripe subscription so webhooks can rebuild our record in any order."""
    return {
        "uid": subscription.customer_id,
        "subscriptionId": subscription.id,
        "boxId": subscription.box_id,
        "cadence": subscription.cadence,
        "firstDelivery": first_delivery.isoformat(),
        "isGift": "true" if subscription.is_gift else "false",
    }
