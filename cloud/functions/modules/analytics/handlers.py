from firebase_functions import https_fn, scheduler_fn

from core import telemetry
from core.firestore import get_db
from modules.analytics.repository import AnalyticsRepository
from modules.analytics.service import AnalyticsService
from modules.billing.wiring import load_catalog
from modules.inventory.repository import InventoryRepository
from modules.inventory.service import InventoryService
from modules.shared.clock import today_in_london
from modules.shared.handler_context import traced_call, traced_schedule


def build_analytics_service() -> AnalyticsService:
    db = get_db()
    return AnalyticsService(AnalyticsRepository(db), InventoryRepository(db), load_catalog)


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_get_overview(req: https_fn.CallableRequest) -> dict:
    return build_analytics_service().overview(today_in_london())


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_get_churn(req: https_fn.CallableRequest) -> dict:
    return build_analytics_service().churn(today_in_london())


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_get_stock(req: https_fn.CallableRequest) -> dict:
    return build_analytics_service().stock(today_in_london())


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_create_reorder(req: https_fn.CallableRequest) -> dict:
    """{itemId} → drafts a reorder for two rounds' worth."""
    db = get_db()
    service = InventoryService(InventoryRepository(db), build_analytics_service())
    reorder = service.draft_reorder(str((req.data or {}).get("itemId") or ""), req.auth.uid, today_in_london())
    return {"id": reorder.id, "itemName": reorder.item_name, "quantity": reorder.quantity}


@scheduler_fn.on_schedule(schedule="5 0 * * *", timezone=scheduler_fn.Timezone("Europe/London"))
@traced_schedule
def snapshot_daily_metrics(event: scheduler_fn.ScheduledEvent) -> None:
    snapshot = build_analytics_service().write_daily_snapshot(today_in_london())
    telemetry.event("metrics_snapshot", active=snapshot["activeSubscriptions"])
