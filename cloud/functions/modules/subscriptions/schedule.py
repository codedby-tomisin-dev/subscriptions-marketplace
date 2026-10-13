"""Delivery-date arithmetic. Mirrors app/pwa/src/shared/utils/dates.ts.

Dates are ISO strings ("2026-10-15") in Firestore and `date` objects here.
"""
import calendar
from datetime import date, datetime, time, timedelta, timezone

from modules.catalog.catalog import Cadence

# Packing needs this many days, so the earliest delivery is this far out...
LEAD_DAYS = 3
# ...and each box is charged this many days before it arrives.
CHARGE_DAYS_BEFORE_DELIVERY = 3
# Charges run early morning UK time on the charge day.
CHARGE_TIME_UTC = time(6, 0, tzinfo=timezone.utc)
# A pause lasts until the 1st of the month this many months out (paused in Oct → Dec 1).
PAUSE_MONTHS = 2

# How many delivery slots a customer can pick from when subscribing.
DELIVERY_CHOICES = 4


def add_months(day: date, months: int) -> date:
    """Adds calendar months, clamping to the month's last day (Jan 31 + 1 → Feb 28)."""
    month_index = day.month - 1 + months
    year, month = day.year + month_index // 12, month_index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def upcoming_delivery_dates(today: date, count: int = DELIVERY_CHOICES) -> list[date]:
    """The next `count` weekdays, starting LEAD_DAYS out."""
    dates: list[date] = []
    cursor = today + timedelta(days=LEAD_DAYS)
    while len(dates) < count:
        if cursor.weekday() < 5:
            dates.append(cursor)
        cursor += timedelta(days=1)
    return dates


def earliest_delivery(today: date) -> date:
    return upcoming_delivery_dates(today, 1)[0]


def following_delivery(delivery: date, cadence: Cadence) -> date:
    return delivery + timedelta(days=7) if cadence == "week" else add_months(delivery, 1)


def pause_resume_date(today: date) -> date:
    return add_months(today, PAUSE_MONTHS).replace(day=1)


def charge_time(delivery: date) -> datetime:
    """When the box arriving on `delivery` is charged."""
    return datetime.combine(delivery - timedelta(days=CHARGE_DAYS_BEFORE_DELIVERY), CHARGE_TIME_UTC)


def iso_month(day: date) -> str:
    return day.isoformat()[:7]
