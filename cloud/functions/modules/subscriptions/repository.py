from google.cloud.firestore import Client
from google.cloud.firestore_v1.base_query import FieldFilter

from modules.customers.repository import CustomersRepository
from modules.shared.clock import timestamp
from modules.subscriptions.models import Event, Subscription

COLLECTION = "subscriptions"
EVENTS = "events"


class SubscriptionsRepository:
    """Subscriptions plus the event log and customer summary that change alongside them."""

    def __init__(self, db: Client, customers: CustomersRepository) -> None:
        self._db = db
        self._customers = customers

    def new_id(self) -> str:
        return self._db.collection(COLLECTION).document().id

    def get(self, subscription_id: str) -> Subscription:
        snapshot = self._db.collection(COLLECTION).document(subscription_id).get()
        if not snapshot.exists:
            raise KeyError("No such subscription")
        return Subscription(id=snapshot.id, **snapshot.to_dict())

    def find_by_stripe_id(self, stripe_subscription_id: str) -> Subscription | None:
        query = self._db.collection(COLLECTION).where(filter=FieldFilter("stripeSubscriptionId", "==", stripe_subscription_id)).limit(1)
        return next((Subscription(id=doc.id, **doc.to_dict()) for doc in query.stream()), None)

    def list_for_customer(self, customer_id: str) -> list[Subscription]:
        query = self._db.collection(COLLECTION).where(filter=FieldFilter("customerId", "==", customer_id))
        return [Subscription(id=doc.id, **doc.to_dict()) for doc in query.stream()]

    def save_with_event(self, subscription: Subscription, event: Event | None) -> Subscription:
        """Writes the subscription and its event together, then refreshes the customer's summary."""
        saved = subscription.model_copy(update={"updated_at": timestamp()})
        batch = self._db.batch()
        batch.set(self._db.collection(COLLECTION).document(saved.id), saved.to_firestore())
        if event is not None:
            batch.set(self._db.collection(EVENTS).document(), event.to_firestore())
        batch.commit()
        self._customers.refresh_summary(saved.customer_id, self.list_for_customer(saved.customer_id))
        return saved

    def add_event(self, event: Event) -> None:
        self._db.collection(EVENTS).add(event.to_firestore())
