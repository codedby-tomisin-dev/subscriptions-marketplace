from firebase_functions import https_fn, scheduler_fn

from core import telemetry
from core.firestore import get_db
from modules.billing.wiring import load_catalog, subscriptions_repository
from modules.fulfilment.repository import OrdersRepository
from modules.fulfilment.service import FulfilmentService
from modules.inventory.repository import InventoryRepository
from modules.shared.clock import today_in_london
from modules.shared.handler_context import traced_call, traced_schedule


def build_fulfilment_service() -> FulfilmentService:
    db = get_db()
    return FulfilmentService(OrdersRepository(db), InventoryRepository(db), subscriptions_repository(), load_catalog)


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_update_order_status(req: https_fn.CallableRequest) -> dict:
    """{orderIds: [...], status: packed|labelled|shipped|delivered} → moves them all, or none."""
    data = req.data or {}
    order_ids = data.get("orderIds")
    if not isinstance(order_ids, list):
        raise ValueError("orderIds must be a list")
    orders = build_fulfilment_service().update_status([str(order_id) for order_id in order_ids], str(data.get("status") or ""))
    return {"updated": [order.id for order in orders]}


@scheduler_fn.on_schedule(schedule="0 20 * * *", timezone=scheduler_fn.Timezone("Europe/London"))
@traced_schedule
def mark_delivered_orders(event: scheduler_fn.ScheduledEvent) -> None:
    count = build_fulfilment_service().mark_delivered(today_in_london())
    telemetry.event("orders_delivered", count=count)
