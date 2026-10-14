from collections import Counter
from datetime import date
from typing import Callable

from core import telemetry
from modules.catalog.catalog import Catalog
from modules.fulfilment.models import Order, OrderStatus
from modules.fulfilment.orders import can_move
from modules.fulfilment.repository import OrdersRepository
from modules.inventory.repository import InventoryRepository
from modules.shared.clock import timestamp
from modules.shared.errors import FailedPrecondition
from modules.subscriptions.models import Event
from modules.subscriptions.repository import SubscriptionsRepository

# Statuses packers set by hand. Refunds go through billing; "delivered" is set by the daily sweep,
# but staff can also set it (e.g. a customer confirms early).
PACKER_STATUSES: tuple[OrderStatus, ...] = ("packed", "labelled", "shipped", "delivered")
MAX_ORDERS_PER_UPDATE = 400


def stock_used(orders: list[Order], catalog: Catalog) -> Counter[str]:
    """One of each recipe item per box, by the order's cadence."""
    used: Counter[str] = Counter()
    for order in orders:
        used.update(item.id for item in catalog.get(order.box_id).items_for(order.cadence))
    return used


class FulfilmentService:
    def __init__(
        self, orders: OrdersRepository, inventory: InventoryRepository, subscriptions: SubscriptionsRepository, catalog: Callable[[], Catalog]
    ) -> None:
        self._orders = orders
        self._catalog = catalog
        self._inventory = inventory
        self._subscriptions = subscriptions

    def update_status(self, order_ids: list[str], status: str) -> list[Order]:
        """Moves orders on through packing. Stock comes off when a box is first marked packed
        (or skips straight past packing)."""
        if status not in PACKER_STATUSES:
            raise ValueError(f"Status must be one of {', '.join(PACKER_STATUSES)}")
        if not order_ids or len(order_ids) > MAX_ORDERS_PER_UPDATE:
            raise ValueError(f"Pick between 1 and {MAX_ORDERS_PER_UPDATE} orders")

        orders = self._orders.get_many(sorted(set(order_ids)))
        stuck = [order for order in orders if not can_move(order.status, status)]  # type: ignore[arg-type]
        if stuck:
            raise FailedPrecondition(f"{stuck[0].id} is already {stuck[0].status}, so it can’t move to {status}.")

        newly_packed = [order for order in orders if order.status == "topack"]
        self._orders.set_statuses(orders, status)  # type: ignore[arg-type]
        if newly_packed:
            self._inventory.subtract_stock(stock_used(newly_packed, self._catalog()))
        if status == "delivered":
            self._record_deliveries(orders)
        telemetry.event("orders_moved", status=status, count=len(orders))
        return [order.model_copy(update={"status": status}) for order in orders]

    def mark_delivered(self, today: date) -> int:
        """Shipped orders whose delivery day has come are delivered (Tracked 24 has no feed here)."""
        due = self._orders.list_shipped_due(today.isoformat())
        if due:
            self._orders.set_statuses(due, "delivered")
            self._record_deliveries(due)
        return len(due)

    def _record_deliveries(self, orders: list[Order]) -> None:
        for order in orders:
            event = Event(
                customer_id=order.customer_id,
                subscription_id=order.subscription_id,
                type="order_delivered",
                actor="system",
                data={"boxId": order.box_id, "orderId": order.id},
                at=timestamp(),
            )
            if order.subscription_id is None:  # a one-off box
                self._subscriptions.add_event(event)
                continue
            subscription = self._subscriptions.get(order.subscription_id)
            if subscription.packed_delivery == order.delivery_date:
                subscription = subscription.model_copy(update={"packed_delivery": None})
            self._subscriptions.save_with_event(subscription, event)
