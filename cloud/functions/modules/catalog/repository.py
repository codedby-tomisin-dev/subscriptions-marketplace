from google.cloud.firestore import Client

from modules.catalog.catalog import Box, Catalog

COLLECTION = "boxes"


class CatalogRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def load(self) -> Catalog:
        return Catalog([Box(id=doc.id, **doc.to_dict()) for doc in self._db.collection(COLLECTION).stream()])

    def exists(self, box_id: str) -> bool:
        return self._db.collection(COLLECTION).document(box_id).get().exists

    def save(self, box: Box) -> None:
        self._db.collection(COLLECTION).document(box.id).set(box.to_firestore())

    def set_status(self, box_id: str, status: str, updated_at: str) -> None:
        self._db.collection(COLLECTION).document(box_id).update({"status": status, "updatedAt": updated_at})
