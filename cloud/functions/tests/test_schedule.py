from datetime import date, datetime, timezone

from modules.subscriptions.schedule import (
    add_months,
    charge_time,
    earliest_delivery,
    following_delivery,
    pause_resume_date,
    upcoming_delivery_dates,
)

SUNDAY = date(2026, 10, 11)
THURSDAY = date(2026, 10, 15)


def test_upcoming_dates_start_three_days_out_and_skip_weekends():
    assert upcoming_delivery_dates(SUNDAY) == [date(2026, 10, 14), date(2026, 10, 15), date(2026, 10, 16), date(2026, 10, 19)]
    # Thursday + 3 is Sunday, so the first slot is Monday.
    assert earliest_delivery(THURSDAY) == date(2026, 10, 19)


def test_add_months_clamps_to_the_end_of_short_months():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2028, 1, 31), 1) == date(2028, 2, 29)
    assert add_months(date(2026, 11, 15), 2) == date(2027, 1, 15)


def test_following_delivery_by_cadence():
    assert following_delivery(THURSDAY, "week") == date(2026, 10, 22)
    assert following_delivery(THURSDAY, "month") == date(2026, 11, 15)


def test_pause_resumes_on_the_first_two_months_out():
    assert pause_resume_date(date(2026, 10, 12)) == date(2026, 12, 1)
    assert pause_resume_date(date(2026, 11, 30)) == date(2027, 1, 1)


def test_boxes_are_charged_three_days_before_delivery():
    assert charge_time(THURSDAY) == datetime(2026, 10, 12, 6, 0, tzinfo=timezone.utc)
