from datetime import date

from modules.analytics.repository import AnalyticsRepository
from modules.analytics.service import AnalyticsService
from modules.catalog.catalog import Catalog, starter_boxes
from modules.inventory.repository import InventoryRepository

TODAY = date(2026, 10, 12)


def test_overview_and_stock_from_firestore(db):
    db.document("subscriptions/s1").set({
        "customerId": "c1", "boxId": "snacks", "cadence": "week", "status": "active", "nextDelivery": "2026-10-15",
        "memberSince": "2026-01", "monthlyValuePence": 5200, "createdAt": "x", "updatedAt": "x",
    })
    db.document("orders/BB-1").set({
        "customerId": "c1", "customerName": "Maya", "city": "Bristol", "subscriptionId": "s1", "boxId": "snacks",
        "cadence": "week", "deliveryDate": "2026-10-14", "shipDate": "2026-10-13", "status": "topack",
        "pricePence": 1200, "placedOn": "2026-10-11", "createdAt": "x", "updatedAt": "x",
    })
    db.document("inventory/snacks-chocolate").set({"boxId": "snacks", "name": "Sea salt chocolate", "stock": 1})
    db.document("metrics_snapshots/2026-09-12").set({"date": "2026-09-12", "activeSubscriptions": 0, "mrrPence": 0})

    catalog = Catalog(starter_boxes())
    service = AnalyticsService(AnalyticsRepository(db), InventoryRepository(db), lambda: catalog)
    overview = service.overview(TODAY)
    assert overview["current"]["activeSubscriptions"] == 1
    assert overview["current"]["mrrPence"] == 5200
    assert overview["previous"]["date"] == "2026-09-12"
    assert overview["shipping"]["byDay"][1] == {"date": "2026-10-13", "total": 1, "shipped": 0}
    chocolate = next(row for box in service.stock(TODAY)["boxes"] for row in box["items"] if row["itemId"] == "snacks-chocolate")
    assert chocolate == {"itemId": "snacks-chocolate", "name": "Sea salt chocolate", "boxId": "snacks", "stock": 1, "needed": 2}
    assert any(item["kind"] == "low_stock" for item in overview["attention"])

    snapshot = service.write_daily_snapshot(TODAY)
    assert db.document("metrics_snapshots/2026-10-12").get().get("activeSubscriptions") == snapshot["activeSubscriptions"]
