from google.cloud.firestore import Client
from firebase_admin import firestore

_db: Client | None = None

def get_db() -> Client:
    """Returns a singleton Firestore client."""
    global _db
    if _db is None:
        _db = firestore.client()
    return _db
