import copy

import pytest

from modules.catalog.catalog import Catalog, monthly_value_pence, starter_boxes
from modules.catalog.repository import CatalogRepository
from modules.catalog.service import CatalogService, slugify
from modules.inventory.repository import InventoryRepository
from tests.fakes import FakeGateway


def test_starter_boxes_load_and_keep_their_prices():
    catalog = Catalog(starter_boxes())
    assert [box.id for box in catalog.active()] == ["datenight", "selfcare", "beauty", "snacks", "home"]
    assert catalog.get("snacks").prices == {"week": 1200, "month": 2600}
    assert catalog.get("datenight").facts[0].icon == "Heart"


def test_monthly_value_normalises_weekly_prices():
    assert monthly_value_pence(2600, "month") == 2600
    assert monthly_value_pence(1200, "week") == 5200  # £12 × 52 / 12


def test_weekly_boxes_hold_fewer_items():
    datenight = Catalog(starter_boxes()).get("datenight")
    assert len(datenight.items_for("week")) < len(datenight.items_for("month"))


def test_slugify():
    assert slugify("  Cosy Reading Nook! ") == "cosy-reading-nook"
    assert slugify("!!!") == "box"


def new_box(**overrides) -> dict:
    return {
        "name": "Reading nook",
        "tone": "lilac",
        "audience": "For the bookworm",
        "prices": {"week": 1300, "month": 2900},
        "planNotes": {"week": "A short read · 2 treats", "month": "The full nook · 5 treats"},
        "pitch": "Chapter one, on repeat.",
        "story": "A paperback, a bookmark and something to sip.",
        "facts": [{"icon": "BookOpen", "label": "A new paperback each month"}],
        "items": [{"name": "Paperback", "inWeeklyBox": True, "costPence": 499}, {"name": "Bookmark", "inWeeklyBox": False}],
        **overrides,
    }


@pytest.fixture
def catalog(db):
    gateway = FakeGateway()
    has_billing = {"value": True}
    service = CatalogService(CatalogRepository(db), InventoryRepository(db), lambda: gateway, lambda: has_billing["value"])
    return service, gateway, has_billing, db


def test_creating_a_box_saves_it_syncs_stripe_and_adds_stock_items(catalog):
    service, gateway, _, db = catalog
    result = service.save_box(new_box())
    assert result["box"]["id"] == "reading-nook"
    assert ("sync_prices", "reading-nook", {"week": 1300, "month": 2900}) in gateway.calls

    saved = CatalogRepository(db).load().get("reading-nook")
    assert [item.id for item in saved.items] == ["reading-nook-paperback", "reading-nook-bookmark"]
    assert [item.cost_pence for item in saved.items] == [499, None]  # costs are optional
    assert db.document("inventory/reading-nook-paperback").get().to_dict() == {
        "boxId": "reading-nook", "name": "Paperback", "inWeeklyBox": True, "stock": 0,
    }
    # A second box with the same name gets its own id.
    assert service.save_box(new_box())["box"]["id"] == "reading-nook-2"


def test_editing_keeps_ids_and_stock_and_only_syncs_stripe_when_prices_change(catalog):
    service, gateway, _, db = catalog
    box = service.save_box(new_box())["box"]
    db.document("inventory/reading-nook-paperback").update({"stock": 40})
    gateway.calls.clear()

    edited = copy.deepcopy(box)
    edited["story"] = "New story."
    edited["items"][0]["name"] = "Hardback"
    service.save_box(edited)
    assert gateway.calls == []
    assert db.document("inventory/reading-nook-paperback").get().to_dict()["stock"] == 40
    assert db.document("inventory/reading-nook-paperback").get().to_dict()["name"] == "Hardback"

    edited["prices"] = {"week": 1400, "month": 2900}
    service.save_box(edited)
    assert gateway.calls[-1][0] == "sync_prices"


def test_saving_without_stripe_configured_still_works(catalog):
    service, gateway, has_billing, _ = catalog
    has_billing["value"] = False
    result = service.save_box(new_box())
    assert result["stripeConfigured"] is False
    assert gateway.calls == []


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"prices": {"week": 50, "month": 2900}}, "weekly price"),
        ({"planNotes": {"week": "", "month": "x"}}, "weekly box includes"),
        ({"items": []}, "at least one item"),
        ({"items": [{"name": "Bookmark", "inWeeklyBox": False}]}, "weekly box"),
        ({"tone": "neon"}, "tone"),
        ({"prices": {}, "planNotes": {}}, "at least one way"),
        ({"prices": {"once": 2500}, "planNotes": {}}, "one-off box includes"),
        ({"prices": {"fortnight": 2500}}, "prices"),
        ({"items": [{"name": "Paperback", "inWeeklyBox": True, "costPence": -1}]}, "greater than or equal to 0"),
    ],
)
def test_rejects_incomplete_boxes(catalog, overrides, message):
    service, _, _, _ = catalog
    with pytest.raises(ValueError, match=message):
        service.save_box(new_box(**overrides))


def test_archiving(catalog):
    service, _, _, db = catalog
    service.save_box(new_box())
    service.set_status("reading-nook", "archived")
    loaded = CatalogRepository(db).load()
    assert loaded.active() == []
    assert loaded.get("reading-nook").status == "archived"
    with pytest.raises(KeyError):
        service.set_status("nope", "archived")


def test_a_box_can_be_sold_only_once(catalog):
    service, gateway, _, db = catalog
    # No weekly box, so nothing has to be ticked for it.
    box = service.save_box(new_box(prices={"once": 3500}, planNotes={"once": "The whole nook, once"}, items=[{"name": "Paperback", "inWeeklyBox": False}]))["box"]
    assert box["prices"] == {"once": 3500}
    assert ("sync_prices", "reading-nook", {"once": 3500}) in gateway.calls
    saved = CatalogRepository(db).load().get("reading-nook")
    assert saved.options == ["once"] and [item.name for item in saved.items_for("once")] == ["Paperback"]
