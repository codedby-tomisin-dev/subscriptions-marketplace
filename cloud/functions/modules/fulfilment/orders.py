"""Pure order rules: numbering, ship dates and which status moves are allowed."""
from datetime import date, timedelta

from modules.fulfilment.models import OrderStatus

# Order numbers continue from the design's sample data (BB-20449).
FIRST_ORDER_NUMBER = 20450

PACKING_FLOW: tuple[OrderStatus, ...] = ("topack", "packed", "labelled", "shipped", "delivered")


def order_number(sequence: int) -> str:
    return f"BB-{FIRST_ORDER_NUMBER + sequence}"


def ship_date_for(delivery: date) -> date:
    """Tracked 24: ships the working day before it arrives."""
    ship = delivery - timedelta(days=1)
    while ship.weekday() >= 5:
        ship -= timedelta(days=1)
    return ship


def can_move(current: OrderStatus, target: OrderStatus) -> bool:
    """Forward through the packing flow (skipping steps is fine). Any order can be refunded once;
    a refunded order that hasn't shipped drops out of the packing queue."""
    if target == "refunded":
        return current != "refunded"
    if current not in PACKING_FLOW or target not in PACKING_FLOW:
        return False
    return PACKING_FLOW.index(target) > PACKING_FLOW.index(current)
