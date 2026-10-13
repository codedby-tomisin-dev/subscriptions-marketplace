from datetime import date

import pytest

from modules.catalog.catalog import Catalog, starter_boxes
from modules.customers.repository import CustomersRepository
from modules.fulfilment.models import Order
from modules.fulfilment.repository import OrdersRepository
from modules.fulfilment.service import FulfilmentService, stock_used
from modules.inventory.repository import InventoryRepository
from modules.shared.errors import FailedPrecondition
from modules.subscriptions.repository import SubscriptionsRepository


def make_order(order_id: str, box_id="snacks", cadence="week", status="topack", delivery="2026-10-15") -> Order:
    return Order(
        id=order_id, customer_id="maya", customer_name="Maya Okafor", city="Bristol", subscription_id="sub1",
        box_id=box_id, cadence=cadence, delivery_date=delivery, ship_date="2026-10-14", status=status,
        price_pence=1200, placed_on="2026-10-12", created_at="x", updated_at="x",
    )


def test_stock_used_follows_each_boxs_recipe():
    used = stock_used([make_order("A", cadence="week"), make_order("B", cadence="month")], Catalog(starter_boxes()))
    assert used["snacks-chocolate"] == 2
    assert used["snacks-nuts"] == 1  # monthly boxes only


@pytest.fixture
def service(db):
    db.document("subscriptions/sub1").set({
        "customerId": "maya", "boxId": "snacks", "cadence": "week", "status": "active", "nextDelivery": "2026-10-22",
        "packedDelivery": "2026-10-15", "memberSince": "2026-03", "monthlyValuePence": 5200,
        "createdAt": "x", "updatedAt": "x",
    })
    db.document("inventory/snacks-chocolate").set({"boxId": "snacks", "name": "Sea salt chocolate", "stock": 10})
    for order in (make_order("BB-1"), make_order("BB-2"), make_order("BB-3", status="shipped")):
        db.document(f"orders/{order.id}").set(order.to_firestore())
    customers = CustomersRepository(db)
    catalog = Catalog(starter_boxes())
    return FulfilmentService(OrdersRepository(db), InventoryRepository(db), SubscriptionsRepository(db, customers), lambda: catalog), db


def test_packing_moves_orders_and_takes_stock_once(service):
    fulfilment, db = service
    fulfilment.update_status(["BB-1", "BB-2"], "packed")
    assert db.document("inventory/snacks-chocolate").get().get("stock") == 8
    fulfilment.update_status(["BB-1", "BB-2"], "labelled")
    assert db.document("inventory/snacks-chocolate").get().get("stock") == 8
    assert db.document("orders/BB-1").get().get("status") == "labelled"


def test_a_batch_with_one_bad_order_changes_nothing(service):
    fulfilment, db = service
    with pytest.raises(FailedPrecondition):
        fulfilment.update_status(["BB-1", "BB-3"], "packed")
    assert db.document("orders/BB-1").get().get("status") == "topack"


def test_packers_cant_refund(service):
    fulfilment, _ = service
    with pytest.raises(ValueError):
        fulfilment.update_status(["BB-1"], "refunded")


def test_sweep_delivers_shipped_orders_and_clears_the_packed_box(service):
    fulfilment, db = service
    assert fulfilment.mark_delivered(date(2026, 10, 14)) == 0
    assert fulfilment.mark_delivered(date(2026, 10, 15)) == 1
    assert db.document("orders/BB-3").get().get("status") == "delivered"
    assert db.document("subscriptions/sub1").get().get("packedDelivery") is None
    assert db.document("customers/maya").get().get("nextDelivery") == "2026-10-22"
