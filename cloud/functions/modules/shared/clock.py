"""The business runs on UK time: delivery days and "today" are London dates."""
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def today_in_london() -> date:
    return datetime.now(LONDON).date()


def timestamp() -> str:
    """An ISO-8601 UTC timestamp for createdAt/updatedAt/at fields; sorts lexically."""
    return now_utc().isoformat(timespec="seconds")
