from datetime import date

import pytest

from modules.shared.errors import FailedPrecondition
from modules.subscriptions import lifecycle
from modules.subscriptions.lifecycle import ChargeFor, SetCancelAtPeriodEnd, StartNewBilling, SwitchPrice
from modules.subscriptions.models import Subscription

TODAY = date(2026, 10, 12)  # a Monday


def make_subscription(**overrides) -> Subscription:
    fields = dict(
        id="sub1",
        customer_id="maya",
        box_id="snacks",
        cadence="week",
        status="active",
        next_delivery="2026-10-22",
        member_since="2026-03",
        monthly_value_pence=5200,
        created_at="2026-03-01T00:00:00+00:00",
        updated_at="2026-03-01T00:00:00+00:00",
    )
    return Subscription(**{**fields, **overrides})


def test_skip_moves_the_next_charge_and_remembers_the_skipped_box():
    change = lifecycle.skip_next(make_subscription())
    assert change.subscription.next_delivery == "2026-10-29"
    assert change.subscription.skipped_delivery == "2026-10-22"
    assert change.billing == ChargeFor(date(2026, 10, 29))


def test_undo_skip_restores_the_skipped_box():
    skipped = lifecycle.skip_next(make_subscription()).subscription
    change = lifecycle.undo_skip(skipped, TODAY)
    assert change.subscription.next_delivery == "2026-10-22"
    assert change.subscription.skipped_delivery is None


def test_undo_skip_refuses_once_the_box_is_too_close_to_pack():
    skipped = lifecycle.skip_next(make_subscription(next_delivery="2026-10-14")).subscription
    with pytest.raises(FailedPrecondition):
        lifecycle.undo_skip(skipped, TODAY)


def test_pause_bills_again_on_the_resume_date():
    change = lifecycle.pause(make_subscription(), TODAY, retention=True)
    assert change.subscription.status == "paused"
    assert change.subscription.resumes_on == "2026-12-01"
    assert change.billing == ChargeFor(date(2026, 12, 1))
    assert change.event_data["retention"] is True


def test_resume_picks_the_earliest_packable_day():
    paused = lifecycle.pause(make_subscription(), TODAY).subscription
    change = lifecycle.resume(paused, TODAY)
    assert change.subscription.status == "active"
    assert change.subscription.next_delivery == "2026-10-15"


def test_cadence_change_switches_price_and_monthly_value():
    change = lifecycle.change_cadence(make_subscription(), "month", price_pence=2600)
    assert change.subscription.monthly_value_pence == 2600
    assert change.subscription.price_pence == 2600
    assert change.billing == SwitchPrice("month")
    with pytest.raises(FailedPrecondition):
        lifecycle.change_cadence(change.subscription, "month", price_pence=2600)


def test_cancel_keeps_the_packed_box_and_can_be_undone():
    subscription = make_subscription(packed_delivery="2026-10-15")
    cancelled = lifecycle.cancel(subscription, TODAY, reason="A bit pricey")
    assert cancelled.subscription.status == "cancelled"
    assert cancelled.subscription.final_delivery == "2026-10-15"
    assert cancelled.subscription.next_delivery is None
    assert cancelled.billing == SetCancelAtPeriodEnd(True)

    undone = lifecycle.undo_cancel(cancelled.subscription, TODAY)
    assert undone.subscription.status == "active"
    assert undone.subscription.next_delivery == "2026-10-22"
    assert undone.subscription.before_cancel is None


def test_restart_after_billing_ended_starts_new_billing():
    cancelled = lifecycle.cancel(make_subscription(), TODAY).subscription
    ended = lifecycle.record_billing_ended(cancelled, TODAY)
    change = lifecycle.restart(ended, TODAY)
    assert change.subscription.status == "active"
    assert change.billing == StartNewBilling(date(2026, 10, 15))


def test_restart_while_cancel_is_pending_just_undoes_it():
    cancelled = lifecycle.cancel(make_subscription(), TODAY).subscription
    assert lifecycle.restart(cancelled, TODAY).event_type == "cancel_undone"


def test_payment_packs_the_box_and_moves_on_a_delivery():
    paid = lifecycle.record_payment(make_subscription(skipped_delivery="2026-10-15"))
    assert paid.packed_delivery == "2026-10-22"
    assert paid.next_delivery == "2026-10-29"
    assert paid.skipped_delivery is None


def test_payment_on_the_resume_date_resumes_a_paused_subscription():
    paused = lifecycle.pause(make_subscription(), TODAY).subscription
    paid = lifecycle.record_payment(paused)
    assert paid.status == "active"
    assert paid.packed_delivery == "2026-12-01"


@pytest.mark.parametrize("action", [lifecycle.skip_next, lambda sub: lifecycle.pause(sub, TODAY)])
def test_cancelled_subscriptions_cant_be_changed(action):
    cancelled = lifecycle.cancel(make_subscription(), TODAY).subscription
    with pytest.raises(FailedPrecondition):
        action(cancelled)
