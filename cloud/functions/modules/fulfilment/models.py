from typing import Literal

from modules.catalog.catalog import Cadence
from modules.shared.document import Document

OrderStatus = Literal["topack", "packed", "labelled", "shipped", "delivered", "refunded"]


class Order(Document):
    """`orders/{number}`, e.g. `orders/BB-20441`. Customer name and city are copied in
    so the packing queue reads one collection."""

    id: str
    customer_id: str
    customer_name: str
    city: str
    subscription_id: str
    box_id: str
    cadence: Cadence
    is_gift: bool = False
    # What goes in the box, from the catalog recipe at the time it was charged.
    items: list[str] = []
    delivery_date: str
    ship_date: str
    status: OrderStatus = "topack"
    price_pence: int
    stripe_invoice_id: str | None = None
    placed_on: str
    created_at: str
    updated_at: str


PaymentStatus = Literal["paid", "failed", "refunded"]


class Payment(Document):
    """`payments/{stripeInvoiceId}`. Its existence (as paid) is what makes invoice.paid idempotent."""

    id: str
    customer_id: str
    subscription_id: str
    order_id: str | None = None
    amount_pence: int
    status: PaymentStatus
    attempt_count: int = 1
    next_retry_at: str | None = None
    created_at: str
    updated_at: str
