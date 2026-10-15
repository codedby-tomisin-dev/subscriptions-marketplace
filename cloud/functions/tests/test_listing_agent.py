import re
from pathlib import Path
from typing import get_args

import pytest
from pydantic_ai import ModelRetry
from pydantic_ai.models.function import FunctionModel
from pydantic_ai.models.test import TestModel

from modules.catalog.catalog import starter_boxes
from pydantic import ValidationError

from modules.catalog.listing_agent import AngleSet, GeneratedListing, ListingAgent, ListingFailed, ListingIcon, _check_angles, _check_listing, _prompt, _too_long
from modules.catalog import handlers
from modules.catalog.listing_agent import ListingNotConfigured
from third_party.parallel.client import ParallelSearchClient

ICONS_TS = Path(__file__).resolve().parents[3] / "app/pwa/src/features/catalog/icons.ts"

PET_CARE = {
    "name": "Pet care",
    "audience": "For the dog who has everything",
    "tone": "sage",
    "pitch": "Good dog, on repeat.",
    "story": "Chews, toys and a little something for you. Tails will wag.",
    "shotDescription": "Rope toy, treat tin, bandana, brush",
    "planNotes": {"week": "A quick treat · 2 goodies", "month": "The full pamper · 5 goodies"},
    "facts": [
        {"icon": "Heart", "label": "Made for dogs"},
        {"icon": "PackageOpen", "label": "5 goodies in the full box"},
        {"icon": "Leaf", "label": "Natural chews"},
    ],
    "ritual": [
        {"title": "Sniff it out", "body": "Lid off. They'll find the treat tin first."},
        {"title": "Play", "body": "The rope toy is for tug, not for the sofa."},
        {"title": "Brush and settle", "body": "A gentle brush, then a long nap."},
    ],
    "contents": [
        {"name": "Natural chews", "description": "Long-lasting, single ingredient", "tone": "apricot"},
        {"name": "Rope toy", "description": "Built for tug", "tone": "sage"},
        {"name": "Treat tin", "description": "Bite-size training treats", "tone": "cream"},
        {"name": "Bandana", "description": "Cotton, one size", "tone": "blush"},
    ],
    "items": [
        {"name": "Natural chews pack", "lifespan": "about a week", "inWeeklyBox": True, "costPence": 250},
        {"name": "Grooming wipes", "lifespan": "about a month", "inWeeklyBox": False, "costPence": 400},
        {"name": "Training treats tin", "lifespan": "about a month", "inWeeklyBox": True, "costPence": 300},
        {"name": "Paw balm", "lifespan": "about a month", "inWeeklyBox": False, "costPence": 350},
    ],
}


class FakeResponse:
    def __init__(self, status: int, body: dict | None = None) -> None:
        self.status_code = status
        self._body = body or {}

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> dict:
        return self._body


def search_client(*responses: FakeResponse) -> tuple[ParallelSearchClient, list[dict]]:
    calls: list[dict] = []
    queue = list(responses)

    def post(url: str, **kwargs):
        calls.append(kwargs["json"])
        return queue.pop(0) if queue else FakeResponse(200, {"results": []})

    return ParallelSearchClient("key", post=post), calls


DOG_RESULTS = {
    "results": [
        {"title": "Best dog toys", "url": "https://example.com/toys", "excerpts": ["Rope toys are a favourite."]},
        {"title": "Dupe", "url": "https://example.com/toys", "excerpts": []},
    ]
}


def test_drafts_the_whole_form_from_an_idea_after_researching_it():
    search, calls = search_client(FakeResponse(200, DOG_RESULTS))
    agent = ListingAgent(TestModel(call_tools=["web_search"], custom_output_args=PET_CARE), search)

    result = agent.draft("  pet   care ", starter_boxes())

    listing = result["listing"]
    assert listing["name"] == "Pet care"
    # Priced from the goods: weekly £5.50 → £12, monthly £13 → £22 (×1.3, + £4.75, up to the next 50p).
    assert listing["prices"] == {"week": 1200, "month": 2200}
    assert listing["items"][1] == {"name": "Grooming wipes", "lifespan": "about a month", "inWeeklyBox": False, "costPence": 400}
    # Never a made-up review, and the admin adds the photo.
    assert listing["testimonial"] is None and listing["image"] is None and listing["status"] == "active"
    assert len(calls) == 1
    assert result["sources"] == [{"title": "Best dog toys", "url": "https://example.com/toys"}]


def test_works_without_search_when_no_parallel_key_is_set():
    agent = ListingAgent(TestModel(custom_output_args=PET_CARE), ParallelSearchClient(""))
    result = agent.draft("pet care", starter_boxes())
    assert result["listing"]["name"] == "Pet care"
    assert result["sources"] == []


def test_prompt_shows_the_design_voice_and_the_boxes_already_on_sale():
    on_sale = starter_boxes()[:1]
    prompt = _prompt("pet care", on_sale)
    assert "The idea: pet care" in prompt
    assert "- Date night: For the two of you." in prompt
    assert "- Snack drawer" not in prompt  # only what's on sale counts as taken...
    for box in starter_boxes():  # ...but all five design listings set the style
        assert box.pitch in prompt


def test_the_design_boxes_fit_the_word_limits():
    # The limits come from these boxes; if one grows, raise its limit on purpose.
    for box in starter_boxes():
        data = box.model_dump(by_alias=True, exclude={"id", "testimonial", "image", "status", "sort_order", "created_at", "updated_at"})
        listing = GeneratedListing(**data | {"items": [{**item, "costPence": 100, "lifespan": "one use"} for item in data["items"]]})  # the design has neither
        assert _too_long(listing) == [], box.name


@pytest.mark.parametrize("idea", ["", "   ", "x" * 201])
def test_rejects_an_empty_or_rambling_idea(idea):
    with pytest.raises(ValueError):
        ListingAgent(TestModel(custom_output_args=PET_CARE)).draft(idea, [])


def test_a_model_failure_becomes_a_friendly_error():
    def broken(messages, info):
        raise RuntimeError("upstream 500")

    with pytest.raises(ListingFailed, match="Try again"):
        ListingAgent(FunctionModel(broken)).draft("pet care", [])


@pytest.mark.parametrize(
    "change, problem",
    [
        ({"ritual": PET_CARE["ritual"][:2]}, "exactly 3 ritual steps"),
        ({"facts": PET_CARE["facts"][:1]}, "3 or 4 facts"),
        ({"items": [{**item, "inWeeklyBox": True} for item in PET_CARE["items"]]}, "some, but not all"),
        ({"items": [{**item, "costPence": 0} for item in PET_CARE["items"]]}, "average supermarket price"),
        ({"items": [{**item, "costPence": 4000} for item in PET_CARE["items"]]}, "monthly box would cost the customer 21300p"),
        ({"pitch": "Everything your very good dog could ever possibly want, on repeat."}, "shorten pitch to 7 words"),
        ({"contents": [{**PET_CARE["contents"][0], "description": "Long-lasting, single ingredient, sourced from British farms only"}, *PET_CARE["contents"][1:]]}, r"contents\[0\]\.description"),
    ],
)
def test_sends_the_model_back_to_fix_counts_and_prices(change, problem):
    with pytest.raises(ModelRetry, match=problem):
        _check_listing(GeneratedListing(**{**PET_CARE, **change}))


def test_icons_match_the_storefront():
    names = re.search(r"BOX_ICONS: Record<string, LucideIcon> = \{(.*?)\};", ICONS_TS.read_text(), re.S).group(1)
    assert sorted(re.findall(r"\w+", names)) == sorted(get_args(ListingIcon))


def test_search_client_gives_up_quietly(monkeypatch):
    monkeypatch.setattr("third_party.parallel.client.BACKOFF_SECONDS", 0)
    assert ParallelSearchClient("").search("dogs") == []
    rate_limited, calls = search_client(*[FakeResponse(429)] * 3)
    assert rate_limited.search("dogs") == [] and len(calls) == 3

    def explode(url, **kwargs):
        raise TimeoutError

    assert ParallelSearchClient("key", post=explode).search("dogs") == []


def test_no_openai_key_says_how_to_set_it_up(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(ListingNotConfigured, match="OPENAI_API_KEY"):
        handlers.build_listing_agent()


ANGLES = {
    "angles": [
        {"title": "A breakfast from a different country, every month", "promise": "Pastries, preserves and a coffee from one country, with a card telling its story.", "why": "Travel the world from your kitchen table."},
        {"title": "The slow Sunday brunch", "promise": "Everything for a lazy brunch for two, a new menu each time.", "why": "The best meal of the week, sorted."},
        {"title": "Porridge, but make it interesting", "promise": "Four oat blends and toppings to try, all new every month.", "why": "Breakfast you look forward to."},
        {"title": "Bake-at-home breakfast", "promise": "A mix, a jam and a recipe card for a weekend bake.", "why": "Warm pastries without the shopping."},
    ]
}


def test_suggests_distinct_experiences_for_an_idea():
    result = ListingAgent(TestModel(custom_output_args=ANGLES)).angles("  breakfast ", starter_boxes())
    assert result["angles"][0]["title"] == "A breakfast from a different country, every month"
    assert set(result["angles"][0]) == {"title", "promise", "why"}


@pytest.mark.parametrize(
    "angles, problem",
    [
        (ANGLES["angles"][:3], "exactly 4"),
        ([ANGLES["angles"][0]] * 4, "different"),
        ([{**ANGLES["angles"][0], "why": "Because waking up to something new from far away is lovely and rare and worth it."}, *ANGLES["angles"][1:]], r"angles\[0\]\.why"),
    ],
)
def test_sends_weak_angles_back(angles, problem):
    with pytest.raises(ModelRetry, match=problem):
        _check_angles(AngleSet(angles=angles))


def test_the_draft_is_built_around_the_chosen_experience():
    prompt = _prompt("breakfast", [], "A breakfast from a different country, every month")
    assert "The experience to build it around: A breakfast from a different country, every month" in prompt
    assert "most compelling specific experience" in _prompt("breakfast", [])


def test_packing_items_must_be_used_up_within_a_month():
    with pytest.raises(ValidationError):
        GeneratedListing(**{**PET_CARE, "items": [{**PET_CARE["items"][0], "lifespan": "years"}, *PET_CARE["items"][1:]]})
