from google.cloud.firestore import Client
from google.cloud.firestore_v1.base_query import FieldFilter

from modules.fulfilment.models import Order, OrderStatus
from modules.shared.clock import timestamp

COLLECTION = "orders"


class OrdersRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def get(self, order_id: str) -> Order:
        snapshot = self._db.collection(COLLECTION).document(order_id).get()
        if not snapshot.exists:
            raise KeyError(f"No order {order_id}")
        return Order(id=snapshot.id, **snapshot.to_dict())

    def get_many(self, order_ids: list[str]) -> list[Order]:
        refs = [self._db.collection(COLLECTION).document(order_id) for order_id in order_ids]
        orders = [Order(id=snap.id, **snap.to_dict()) for snap in self._db.get_all(refs) if snap.exists]
        missing = set(order_ids) - {order.id for order in orders}
        if missing:
            raise KeyError(f"No order {sorted(missing)[0]}")
        return orders

    def set_statuses(self, orders: list[Order], status: OrderStatus) -> None:
        batch = self._db.batch()
        now = timestamp()
        for order in orders:
            batch.update(self._db.collection(COLLECTION).document(order.id), {"status": status, "updatedAt": now})
        batch.commit()

    def list_shipped_due(self, on_or_before: str) -> list[Order]:
        """Shipped orders whose delivery date has arrived."""
        query = (
            self._db.collection(COLLECTION)
            .where(filter=FieldFilter("status", "==", "shipped"))
            .where(filter=FieldFilter("deliveryDate", "<=", on_or_before))
        )
        return [Order(id=doc.id, **doc.to_dict()) for doc in query.stream()]
