from typing import Callable

from google.cloud import firestore
from google.cloud.firestore import Client, Increment

from modules.fulfilment.models import Order, Payment
from modules.fulfilment.orders import order_number
from modules.shared.clock import timestamp
from modules.subscriptions.models import Event, Subscription

PAYMENTS = "payments"
ORDERS = "orders"
ORDER_COUNTER = ("counters", "orders")


class BillingRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def find_payment(self, invoice_id: str) -> Payment | None:
        snapshot = self._db.collection(PAYMENTS).document(invoice_id).get()
        return Payment(id=snapshot.id, **snapshot.to_dict()) if snapshot.exists else None

    def save_payment(self, payment: Payment) -> None:
        self._db.collection(PAYMENTS).document(payment.id).set(payment.to_firestore())

    def record_invoice_paid(
        self,
        *,
        invoice_id: str,
        amount_pence: int,
        subscription: Subscription,
        build_order: Callable[[str], Order],
        event: Event,
    ) -> Order | None:
        """In one transaction: number and create the order, mark the invoice paid, advance the
        subscription, log the event and add to lifetime value. Returns None if the invoice was
        already recorded, which is what makes webhook retries safe."""
        return self.record_paid_order(
            payment_id=invoice_id,
            customer_id=subscription.customer_id,
            amount_pence=amount_pence,
            subscription=subscription,
            build_order=build_order,
            event=event,
        )

    def record_paid_order(
        self,
        *,
        payment_id: str,
        customer_id: str,
        amount_pence: int,
        subscription: Subscription | None,
        build_order: Callable[[str], Order],
        event: Event,
    ) -> Order | None:
        """`record_invoice_paid` for any payment; a one-off box has no subscription to advance."""
        db = self._db
        payment_ref = db.collection(PAYMENTS).document(payment_id)
        counter_ref = db.collection(ORDER_COUNTER[0]).document(ORDER_COUNTER[1])

        @firestore.transactional
        def write(transaction: firestore.Transaction) -> Order | None:
            existing = payment_ref.get(transaction=transaction)
            if existing.exists and existing.get("status") in ("paid", "refunded"):
                return None
            counter = counter_ref.get(transaction=transaction)
            sequence = counter.get("next") if counter.exists else 0

            now = timestamp()
            order = build_order(order_number(sequence))
            payment = Payment(
                id=payment_id,
                customer_id=customer_id,
                subscription_id=subscription.id if subscription else None,
                order_id=order.id,
                amount_pence=amount_pence,
                status="paid",
                attempt_count=existing.get("attemptCount") if existing.exists else 1,
                created_at=existing.get("createdAt") if existing.exists else now,
                updated_at=now,
            )
            transaction.set(counter_ref, {"next": sequence + 1})
            transaction.set(db.collection(ORDERS).document(order.id), order.to_firestore())
            transaction.set(payment_ref, payment.to_firestore())
            if subscription:
                transaction.set(db.collection("subscriptions").document(subscription.id), {**subscription.to_firestore(), "updatedAt": now})
            transaction.set(db.collection("events").document(), event.to_firestore())
            transaction.set(
                db.collection("customers").document(customer_id),
                {"ltvPence": Increment(amount_pence), "updatedAt": now},
                merge=True,
            )
            return order

        return write(db.transaction())
