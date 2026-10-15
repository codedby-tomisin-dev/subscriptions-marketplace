from firebase_functions import https_fn, options
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

from core import config
from core.firestore import get_db
from modules.billing.wiring import stripe_gateway
from modules.catalog.illustrations import IllustrationService, IllustrationsNotConfigured, OpenAIImages, StorageUploader
from modules.catalog.listing_agent import ListingAgent, ListingNotConfigured
from modules.catalog.repository import CatalogRepository
from modules.catalog.service import CatalogService
from modules.inventory.repository import InventoryRepository
from modules.shared.handler_context import traced_call
from third_party.parallel.client import ParallelSearchClient


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


def build_listing_agent() -> ListingAgent:
    if not config.openai_api_key():
        raise ListingNotConfigured()
    model = OpenAIResponsesModel(config.listing_model(), provider=OpenAIProvider(api_key=config.openai_api_key()))
    return ListingAgent(model, ParallelSearchClient(config.parallel_search_api_key()))


# AI calls need more than the defaults: a draft with research takes a minute or so (default timeout 60s),
# and the OpenAI and PydanticAI libraries alone use most of the default 256 MiB, which kills the instance.
AI_CALL = {"timeout_sec": 180, "memory": options.MemoryOption.GB_1}


@https_fn.on_call(**AI_CALL)
@traced_call(require_admin=True)
def admin_suggest_box_angles(req: https_fn.CallableRequest) -> dict:
    """{idea} → {angles: [{title, promise, why}]}: experiences a box for this idea could deliver."""
    idea = str((req.data or {}).get("idea") or "")
    catalog = CatalogRepository(get_db()).load().all()
    return build_listing_agent().angles(idea, catalog)


@https_fn.on_call(**AI_CALL)
@traced_call(require_admin=True)
def admin_generate_box_listing(req: https_fn.CallableRequest) -> dict:
    """{idea, angle?} → {listing, sources}: a draft for the New box form, built around the
    experience in `angle` when given. Saves nothing."""
    data = req.data or {}
    catalog = CatalogRepository(get_db()).load().all()
    return build_listing_agent().draft(str(data.get("idea") or ""), catalog, angle=str(data.get("angle") or "") or None)


def build_illustration_service() -> IllustrationService:
    if not config.openai_api_key():
        raise IllustrationsNotConfigured()
    return IllustrationService(
        OpenAIImages(config.openai_api_key(), config.image_model()),
        StorageUploader(config.storage_emulator_host()),
    )


@https_fn.on_call(**AI_CALL)
@traced_call(require_admin=True)
def admin_generate_box_illustration(req: https_fn.CallableRequest) -> dict:
    """{name, audience, objects, tone} → {illustration: url}. Uploads the picture; the box saves it."""
    return build_illustration_service().draw(req.data or {})
