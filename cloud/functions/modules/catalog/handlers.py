from firebase_functions import https_fn

from core import config
from core.firestore import get_db
from modules.billing.wiring import stripe_gateway
from modules.catalog.repository import CatalogRepository
from modules.catalog.service import CatalogService
from modules.inventory.repository import InventoryRepository
from modules.shared.handler_context import traced_call


def build_catalog_service() -> CatalogService:
    db = get_db()
    return CatalogService(CatalogRepository(db), InventoryRepository(db), stripe_gateway, lambda: bool(config.stripe_secret_key()))


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_save_box(req: https_fn.CallableRequest) -> dict:
    """{box: {...}} → creates (no id) or updates a box, syncing its prices to Stripe."""
    box = (req.data or {}).get("box")
    if not isinstance(box, dict):
        raise ValueError("box must be an object")
    return build_catalog_service().save_box(box)


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_set_box_status(req: https_fn.CallableRequest) -> dict:
    """{boxId, status: active|archived}. Archived boxes leave the storefront; existing subscriptions carry on."""
    data = req.data or {}
    build_catalog_service().set_status(str(data.get("boxId") or ""), str(data.get("status") or ""))
    return {"ok": True}
