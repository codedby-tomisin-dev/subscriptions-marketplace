import re
from typing import Callable

from pydantic import ValidationError

from core import telemetry
from modules.billing.gateway import BillingGateway
from modules.catalog.catalog import Box, CADENCES
from modules.catalog.repository import CatalogRepository
from modules.inventory.repository import InventoryRepository
from modules.shared.clock import timestamp

MIN_PRICE_PENCE = 100
MAX_PRICE_PENCE = 100_000


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:40] or "box"


def _first_error(error: ValidationError) -> str:
    detail = error.errors()[0]
    where = ".".join(str(part) for part in detail["loc"])
    return f"{where}: {detail['msg']}"


class CatalogService:
    """Creating and editing boxes from the admin."""

    def __init__(
        self,
        repo: CatalogRepository,
        inventory: InventoryRepository,
        gateway: Callable[[], BillingGateway],
        has_billing: Callable[[], bool],
    ) -> None:
        self._repo = repo
        self._inventory = inventory
        self._gateway = gateway
        # False when no Stripe key is set (local dev without Stripe): boxes still save.
        self._has_billing = has_billing

    def save_box(self, data: dict) -> dict:
        """Creates a box (no `id`) or replaces one. Returns the saved box and what changed in Stripe."""
        is_new = not data.get("id")
        box_id = self._new_id(str(data.get("name") or "")) if is_new else str(data["id"])
        previous = None if is_new else self._repo.load().get(box_id)

        now = timestamp()
        try:
            box = Box(
                **{
                    **data,
                    "id": box_id,
                    "items": self._with_item_ids(box_id, data.get("items") or []),
                    "created_at": previous.created_at if previous else now,
                    "updated_at": now,
                }
            )
        except ValidationError as error:
            raise ValueError(_first_error(error)) from None
        self._validate(box)

        prices_changed = previous is None or previous.prices != box.prices or previous.name != box.name
        stripe_updated: list[str] = []
        if prices_changed and self._has_billing():
            stripe_updated = self._gateway().sync_box_prices(box.id, box.name, dict(box.prices))

        self._repo.save(box)
        self._inventory.ensure_items(box)
        telemetry.event("box_saved", box_id=box.id, is_new=is_new, stripe_prices=len(stripe_updated))
        return {"box": {"id": box.id, **box.to_firestore()}, "stripeUpdated": stripe_updated, "stripeConfigured": self._has_billing()}

    def set_status(self, box_id: str, status: str) -> None:
        if status not in ("active", "archived"):
            raise ValueError("Status must be active or archived")
        self._repo.load().get(box_id)  # KeyError if unknown
        self._repo.set_status(box_id, status, timestamp())

    def _new_id(self, name: str) -> str:
        base = slugify(name)
        candidate, suffix = base, 2
        while self._repo.exists(candidate):
            candidate, suffix = f"{base}-{suffix}", suffix + 1
        return candidate

    @staticmethod
    def _with_item_ids(box_id: str, items: list[dict]) -> list[dict]:
        """New items get an id from their name; existing ids are kept so stock stays attached."""
        used: set[str] = set()
        result = []
        for item in items:
            item_id = item.get("id") or f"{box_id}-{slugify(str(item.get('name') or 'item'))}"
            while item_id in used:
                item_id += "-2"
            used.add(item_id)
            result.append({**item, "id": item_id})
        return result

    @staticmethod
    def _validate(box: Box) -> None:
        if not box.name.strip():
            raise ValueError("Give the box a name.")
        for cadence in CADENCES:
            price = box.prices.get(cadence)
            if price is None or not MIN_PRICE_PENCE <= price <= MAX_PRICE_PENCE:
                raise ValueError(f"The {cadence}ly price must be between £1 and £1,000.")
            if not box.plan_notes.get(cadence, "").strip():
                raise ValueError(f"Describe what the {cadence}ly box includes.")
        if not box.items:
            raise ValueError("Add at least one item that goes in the box.")
        if not box.items_for("week"):
            raise ValueError("At least one item needs to go in the weekly box.")
