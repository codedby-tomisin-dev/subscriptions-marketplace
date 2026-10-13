from google.cloud.firestore import Client
from google.cloud.firestore_v1.base_query import FieldFilter

from modules.customers.models import Customer
from modules.fulfilment.models import Order, Payment
from modules.subscriptions.models import Event, Subscription

SNAPSHOTS = "metrics_snapshots"


class AnalyticsRepository:
    """Read-mostly queries behind the admin dashboards.

    Live subscriptions are read in full, which is fine for a few thousand. Past
    that, move the totals to Firestore count()/sum() aggregations or the nightly snapshot.
    """

    def __init__(self, db: Client) -> None:
        self._db = db

    def live_subscriptions(self) -> list[Subscription]:
        query = self._db.collection("subscriptions").where(filter=FieldFilter("status", "in", ["active", "paused"]))
        return [Subscription(id=doc.id, **doc.to_dict()) for doc in query.stream()]

    def events_since(self, event_types: list[str], since: str) -> list[Event]:
        events: list[Event] = []
        for event_type in event_types:
            query = (
                self._db.collection("events")
                .where(filter=FieldFilter("type", "==", event_type))
                .where(filter=FieldFilter("at", ">=", since))
                .order_by("at", direction="DESCENDING")
            )
            events.extend(Event(id=doc.id, **doc.to_dict()) for doc in query.stream())
        return sorted(events, key=lambda event: event.at, reverse=True)

    def orders_shipping_between(self, first: str, last: str) -> list[Order]:
        query = self._db.collection("orders").where(filter=FieldFilter("shipDate", ">=", first)).where(filter=FieldFilter("shipDate", "<=", last))
        return [Order(id=doc.id, **doc.to_dict()) for doc in query.stream()]

    def orders_to_pack(self) -> list[Order]:
        query = self._db.collection("orders").where(filter=FieldFilter("status", "==", "topack"))
        return [Order(id=doc.id, **doc.to_dict()) for doc in query.stream()]

    def failed_payments_since(self, since: str) -> list[Payment]:
        query = self._db.collection("payments").where(filter=FieldFilter("status", "==", "failed")).where(filter=FieldFilter("updatedAt", ">=", since))
        return [Payment(id=doc.id, **doc.to_dict()) for doc in query.stream()]

    def customers(self, uids: list[str]) -> dict[str, Customer]:
        refs = [self._db.collection("customers").document(uid) for uid in set(uids)]
        return {snap.id: Customer(id=snap.id, **snap.to_dict()) for snap in self._db.get_all(refs) if snap.exists}

    def snapshot_on_or_before(self, day: str) -> dict | None:
        query = self._db.collection(SNAPSHOTS).where(filter=FieldFilter("date", "<=", day)).order_by("date", direction="DESCENDING").limit(1)
        return next((doc.to_dict() for doc in query.stream()), None)

    def save_snapshot(self, day: str, metrics: dict) -> None:
        self._db.collection(SNAPSHOTS).document(day).set({"date": day, **metrics})
