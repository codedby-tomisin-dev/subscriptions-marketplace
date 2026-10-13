from google.cloud.firestore import Client, Increment

from modules.customers.models import Customer
from modules.customers.summary import summarise_subscriptions
from modules.subscriptions.models import Subscription
from modules.shared.clock import timestamp

COLLECTION = "customers"


class CustomersRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def find(self, uid: str) -> Customer | None:
        snapshot = self._db.collection(COLLECTION).document(uid).get()
        return Customer(id=uid, **snapshot.to_dict()) if snapshot.exists else None

    def get(self, uid: str) -> Customer:
        customer = self.find(uid)
        if customer is None:
            raise KeyError("No such customer")
        return customer

    def save(self, customer: Customer) -> None:
        self._db.collection(COLLECTION).document(customer.id).set(customer.to_firestore())

    def update_fields(self, uid: str, fields: dict) -> None:
        """Merges camelCase `fields` into the customer doc."""
        self._db.collection(COLLECTION).document(uid).set({**fields, "updatedAt": timestamp()}, merge=True)

    def add_to_lifetime_value(self, uid: str, pence: int) -> None:
        self.update_fields(uid, {"ltvPence": Increment(pence)})

    def refresh_summary(self, uid: str, subscriptions: list[Subscription]) -> None:
        summary = summarise_subscriptions(subscriptions)
        self.update_fields(
            uid,
            {
                "subscriptionSummary": [item.to_firestore() for item in summary["subscription_summary"]],
                "nextDelivery": summary["next_delivery"],
                "overallStatus": summary["overall_status"],
            },
        )
