from modules.customers.models import OverallStatus, SubscriptionSummary
from modules.subscriptions.models import Subscription

_STATUS_RANK: dict[str, int] = {"active": 0, "paused": 1, "cancelled": 2}


def summarise_subscriptions(subscriptions: list[Subscription]) -> dict:
    """The customer fields derived from their subscriptions: the list, next box and headline status."""
    ordered = sorted(subscriptions, key=lambda sub: (_STATUS_RANK[sub.status], sub.created_at))
    upcoming = [
        day
        for sub in subscriptions
        if sub.status != "cancelled"
        for day in (sub.packed_delivery, sub.next_delivery if sub.status == "active" else None)
        if day
    ]
    overall: OverallStatus = ordered[0].status if ordered else "none"
    return {
        "subscription_summary": [SubscriptionSummary(box_id=sub.box_id, cadence=sub.cadence, status=sub.status) for sub in ordered],
        "next_delivery": min(upcoming) if upcoming else None,
        "overall_status": overall,
    }
