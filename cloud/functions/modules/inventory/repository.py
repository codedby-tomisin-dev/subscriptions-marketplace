from collections import Counter

from google.api_core.exceptions import AlreadyExists
from google.cloud.firestore import Client, Increment

from modules.catalog.catalog import Box

from modules.inventory.models import InventoryItem, Reorder

COLLECTION = "inventory"
REORDERS = "reorders"


class InventoryRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def list_all(self) -> list[InventoryItem]:
        return [InventoryItem(id=doc.id, **doc.to_dict()) for doc in self._db.collection(COLLECTION).stream()]

    def get(self, item_id: str) -> InventoryItem:
        snapshot = self._db.collection(COLLECTION).document(item_id).get()
        if not snapshot.exists:
            raise KeyError(f"No stock item {item_id}")
        return InventoryItem(id=snapshot.id, **snapshot.to_dict())

    def subtract_stock(self, used: Counter[str]) -> None:
        """Atomic decrements, so two packers marking orders at once don't lose a count."""
        batch = self._db.batch()
        for item_id, count in used.items():
            batch.set(self._db.collection(COLLECTION).document(item_id), {"stock": Increment(-count)}, merge=True)
        batch.commit()

    def ensure_items(self, box: Box) -> None:
        """Every recipe item has an inventory doc. New ones start at zero stock; names stay current."""
        for item in box.items:
            ref = self._db.collection(COLLECTION).document(item.id)
            details = {"boxId": box.id, "name": item.name, "inWeeklyBox": item.in_weekly_box}
            try:
                ref.create({**details, "stock": 0})
            except AlreadyExists:
                ref.update(details)

    def add_reorder(self, reorder: Reorder) -> str:
        ref = self._db.collection(REORDERS).document()
        ref.set(reorder.to_firestore())
        return ref.id
