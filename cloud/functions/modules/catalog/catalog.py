"""The box catalog as the backend sees it. Boxes live in Firestore (`boxes/{id}`),
edited from the admin; `starter_boxes.json` seeds a fresh project.

Each box is sold any of three ways, chosen per box in the admin: weekly or monthly
subscriptions (`Cadence`), or a one-off box. `Box.prices` holds a price only for
the ways it's on sale.

Stripe prices are found by lookup key (`snacks_week`, `snacks_once`, ...). Saving a
new price in the admin creates a new Stripe price and moves the lookup key to it, so
new subscribers pay the new price while existing ones keep theirs.
"""
import json
from pathlib import Path
from typing import Literal, get_args

from pydantic import Field

from modules.shared.document import Document

Cadence = Literal["week", "month"]
CADENCES: tuple[Cadence, ...] = get_args(Cadence)
# How a box can be bought: a subscription cadence, or once.
PurchaseOption = Literal["week", "month", "once"]
PURCHASE_OPTIONS: tuple[PurchaseOption, ...] = get_args(PurchaseOption)
ONE_OFF: PurchaseOption = "once"
Tone = Literal["blush", "apricot", "sage", "plum", "lilac", "cream"]
BoxStatus = Literal["active", "archived"]

CURRENCY = "gbp"

# Average weeks per month, for normalising weekly revenue to monthly.
WEEKS_PER_MONTH = 52 / 12

STARTER_BOXES = Path(__file__).with_name("starter_boxes.json")


def price_lookup_key(box_id: str, option: PurchaseOption) -> str:
    return f"{box_id}_{option}"


def monthly_value_pence(price_pence: int, cadence: Cadence) -> int:
    """What one subscription is worth per month, for recurring-revenue figures."""
    return round(price_pence * WEEKS_PER_MONTH) if cadence == "week" else price_pence


def parse_cadence(value: object) -> Cadence:
    if value not in CADENCES:
        raise ValueError(f"Cadence must be one of {', '.join(CADENCES)}")
    return value  # type: ignore[return-value]


def parse_purchase_option(value: object) -> PurchaseOption:
    if value not in PURCHASE_OPTIONS:
        raise ValueError(f"Choose one of {', '.join(PURCHASE_OPTIONS)}")
    return value  # type: ignore[return-value]


OPTION_NAMES: dict[PurchaseOption, str] = {"week": "weekly", "month": "monthly", "once": "one-off"}


class Fact(Document):
    icon: str
    label: str


class RitualStep(Document):
    title: str
    body: str


class ContentsItem(Document):
    name: str
    description: str
    tone: Tone


class Testimonial(Document):
    quote: str
    attribution: str


class InventoryItem(Document):
    """One thing that goes in the box, tracked in `inventory/{id}`."""

    id: str
    name: str
    # Monthly boxes hold everything; weekly boxes are smaller.
    in_weekly_box: bool = True
    # What one costs us: the average shelf price across the big UK supermarkets. For the editor's profit sums.
    cost_pence: int | None = Field(default=None, ge=0)


class Box(Document):
    """`boxes/{id}`: everything the storefront shows, plus prices and the packing recipe."""

    id: str
    name: str
    tone: Tone
    audience: str
    shot_description: str = ""
    # The box tile and the page's hero: drawn by the admin's illustration agent, or the design's SVGs.
    illustration: str | None = None
    # A real photo, uploaded by hand; the box page's gallery leads with it.
    image: str | None = None
    # Only the ways it's on sale have a price (see `options`).
    prices: dict[PurchaseOption, int]
    plan_notes: dict[PurchaseOption, str]
    pitch: str
    story: str
    facts: list[Fact] = Field(default_factory=list)
    ritual: list[RitualStep] = Field(default_factory=list)
    contents: list[ContentsItem] = Field(default_factory=list)
    testimonial: Testimonial | None = None
    items: list[InventoryItem] = Field(default_factory=list)
    status: BoxStatus = "active"
    sort_order: int = 0
    created_at: str | None = None
    updated_at: str | None = None

    @property
    def options(self) -> list[PurchaseOption]:
        """The ways this box is on sale, in display order."""
        return [option for option in PURCHASE_OPTIONS if option in self.prices]

    def offers(self, option: PurchaseOption) -> bool:
        return option in self.prices

    def price_lookup_key(self, option: PurchaseOption) -> str:
        return price_lookup_key(self.id, option)

    def items_for(self, option: PurchaseOption) -> list[InventoryItem]:
        """Weekly boxes hold the ticked items; monthly and one-off boxes hold everything."""
        return [item for item in self.items if item.in_weekly_box] if option == "week" else self.items

    def monthly_value_pence(self, cadence: Cadence) -> int:
        """Raises KeyError if the box isn't sold at this cadence."""
        return monthly_value_pence(self.prices[cadence], cadence)


class Catalog:
    """Every box, archived ones included (old subscriptions and orders still point at them)."""

    def __init__(self, boxes: list[Box]) -> None:
        self._boxes = {box.id: box for box in sorted(boxes, key=lambda box: (box.sort_order, box.name))}

    def get(self, box_id: str) -> Box:
        """Raises KeyError (→ NOT_FOUND) for an unknown box."""
        try:
            return self._boxes[box_id]
        except KeyError:
            raise KeyError(f"Unknown box '{box_id}'") from None

    def all(self) -> list[Box]:
        return list(self._boxes.values())

    def active(self) -> list[Box]:
        return [box for box in self._boxes.values() if box.status == "active"]


def starter_boxes() -> list[Box]:
    """The five launch boxes, for seeding a fresh project and for tests."""
    return [Box(**box) for box in json.loads(STARTER_BOXES.read_text())]
