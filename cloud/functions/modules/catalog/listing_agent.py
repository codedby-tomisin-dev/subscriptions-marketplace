"""Drafts a whole box listing from a one-line idea ("pet care"), for the admin to review.

A PydanticAI agent on OpenAI returns a `GeneratedListing`. When a Parallel.ai key
is set it can first research the idea on the web, a few searches at most. Nothing
here saves anything: the draft fills the New box form, and the admin creates
the box from there.

It never writes a testimonial. A made-up customer quote would read as a real review.
"""
import json
import logging
from dataclasses import dataclass, field
from typing import Literal

from pydantic import Field
from pydantic_ai import Agent, ModelRetry, RunContext

from core import telemetry
from modules.catalog.catalog import Box, Tone
from modules.shared.document import Document
from modules.shared.errors import FailedPrecondition
from third_party.parallel.client import ParallelSearchClient, SearchResult, digest

MAX_IDEA_LENGTH = 200
MAX_SEARCHES = 4
# Prices the agent may suggest, in pence. The starter boxes run £12–£19 a week.
MIN_PRICE_PENCE = 500
MAX_PRICE_PENCE = 15_000

# The icons the storefront can draw for highlights. Must match BOX_ICONS in
# app/pwa/src/features/catalog/icons.ts (tests/test_listing_agent.py checks).
ListingIcon = Literal[
    "BadgeCheck", "Bath", "BookOpen", "Clock", "Coffee", "Cookie", "Flame", "Flower2", "Gem", "Gift", "Heart", "House",
    "Leaf", "Moon", "Music", "PackageOpen", "Palette", "Recycle", "Smile", "Sparkles", "Star", "Sun", "WheatOff", "Wine",
]  # fmt: skip


class ListingFact(Document):
    icon: ListingIcon
    label: str = Field(description="2–5 words, e.g. 'Made for two' or '6 treats in the full box'.")


class ListingStep(Document):
    title: str = Field(description="A short imperative, e.g. 'Open it together'.")
    body: str = Field(description="One or two short sentences.")


class ListingContentsItem(Document):
    name: str = Field(description="What customers see in the box, e.g. 'Hand-poured candle'.")
    description: str = Field(description="A few words of detail, e.g. 'Lavender, jasmine, rosewood'.")
    tone: Tone = Field(description="Pastel for the placeholder tile; pick one that suits the item.")


class ListingItem(Document):
    name: str = Field(description="A concrete thing to stock and pack, e.g. 'Shiraz 75cl'.")
    in_weekly_box: bool = Field(description="Weekly boxes are smaller and only hold some items; monthly boxes hold all of them.")


class ListingPrices(Document):
    week: int = Field(description="Weekly price in pence, e.g. 1500 for £15.")
    month: int = Field(description="Monthly price in pence; more than weekly, as the monthly box is fuller.")


class ListingPlanNotes(Document):
    week: str = Field(description="What a weekly box holds, e.g. 'A mini date · 3 treats'.")
    month: str = Field(description="What a monthly box holds, e.g. 'The full evening · 6 treats'.")


class GeneratedListing(Document):
    """Everything the New box form needs except the photo. Field names match the form."""

    name: str = Field(description="1–3 words, sentence case, e.g. 'Date night'.")
    audience: str = Field(description="Who it's for, starting 'For', e.g. 'For the two of you'.")
    tone: Tone
    pitch: str = Field(description="The page headline: one short, warm line, e.g. 'One very good evening, on repeat.'")
    story: str = Field(description="Two sentences under the headline: what's in it and the feeling it gives.")
    shot_description: str = Field(description="Art direction for the hero photo: the key items, comma-separated.")
    prices: ListingPrices
    plan_notes: ListingPlanNotes
    facts: list[ListingFact] = Field(description="3 or 4 highlights.")
    ritual: list[ListingStep] = Field(description="Exactly 3 steps for enjoying the box, in order.")
    contents: list[ListingContentsItem] = Field(description="4 to 6 things a full box typically holds.")
    items: list[ListingItem] = Field(description="4 to 8 packing items matching the contents.")


@dataclass
class ResearchLog:
    """Per-run state for the search tool: its call count and every source it read."""

    searches: int = 0
    sources: list[SearchResult] = field(default_factory=list)


INSTRUCTIONS = """\
You write product listings for Bonbon, a UK subscription-box shop. Customers pick a
box and get it weekly or monthly. Each box is a small, physical treat, packed by hand.

Write in Bonbon's voice: warm, playful and brief. British English. Plain words, short
sentences, no exclamation marks, no hype ("ultimate", "curated luxury", "elevate").
Talk to the customer as "you".

Rules:
- Everything must be things we could really buy and pack in the UK. No brand names.
- Make no claims you can't back up: nothing like "vet-approved", "organic" or "award-winning".
- Weekly boxes are a smaller version of the monthly box; price them like the examples.
- Make the box clearly different from the boxes already on sale.
"""

RESEARCH_INSTRUCTIONS = """
Before writing, use web_search a couple of times (at most {limit}) to learn what people
who'd want this box actually love, and which products are typical for it in the UK.
Ask plain-language questions. Then write the listing from what you learned.
"""


class ListingAgent:
    """`model` is a PydanticAI model (OpenAI in production, a TestModel in tests)."""

    def __init__(self, model: object, search: ParallelSearchClient | None = None, max_searches: int = MAX_SEARCHES) -> None:
        self._model = model
        self._search = search if search and search.available else None
        self._max_searches = max_searches

    def draft(self, idea: str, catalog: list[Box]) -> dict:
        """{idea} → {listing: the New box form's fields, sources: [{title, url}]}."""
        idea = " ".join(idea.split())
        if not idea:
            raise ValueError("Describe the idea for the box, e.g. “pet care”.")
        if len(idea) > MAX_IDEA_LENGTH:
            raise ValueError(f"Keep the idea under {MAX_IDEA_LENGTH} characters.")

        research = ResearchLog()
        try:
            result = self._agent().run_sync(_prompt(idea, catalog), deps=research)
        except Exception as error:  # the model or its API: nothing the admin can fix but a retry
            telemetry.event("listing_draft_failed", level=logging.WARNING, idea=idea, error=repr(error))
            raise ListingFailed() from error
        listing: GeneratedListing = result.output
        telemetry.event("listing_drafted", idea=idea, name=listing.name, searches=research.searches)
        return {
            "listing": {
                **listing.model_dump(by_alias=True),
                "image": None,
                "testimonial": None,
                "status": "active",
            },
            "sources": _unique_sources(research.sources),
        }

    def _agent(self) -> Agent[ResearchLog, GeneratedListing]:
        instructions = INSTRUCTIONS + (RESEARCH_INSTRUCTIONS.format(limit=self._max_searches) if self._search else "")
        agent = Agent(
            self._model,
            output_type=GeneratedListing,
            instructions=instructions,
            deps_type=ResearchLog,
            name="listing_agent",
            output_retries=3,
        )
        agent.output_validator(_check_listing)

        if self._search:
            search, limit = self._search, self._max_searches

            @agent.tool
            def web_search(ctx: RunContext[ResearchLog], query: str) -> str:
                """Search the web. Pass one plain-language question."""
                ctx.deps.searches += 1
                if ctx.deps.searches > limit:
                    return "No results: the search limit for this listing is reached. Write it with what you have."
                results = search.search(query)
                ctx.deps.sources.extend(results)
                telemetry.event("listing_search", query=query, results=len(results))
                return digest(results)

        return agent


def _check_listing(listing: GeneratedListing) -> GeneratedListing:
    """Counts and prices the schema can't express. A failure sends the model back to fix it."""
    problems = []
    if not 3 <= len(listing.facts) <= 4:
        problems.append("give 3 or 4 facts")
    if len(listing.ritual) != 3:
        problems.append("give exactly 3 ritual steps")
    if not 4 <= len(listing.contents) <= 6:
        problems.append("give 4 to 6 contents rows")
    if not 4 <= len(listing.items) <= 8:
        problems.append("give 4 to 8 packing items")
    elif not any(item.in_weekly_box for item in listing.items) or all(item.in_weekly_box for item in listing.items):
        problems.append("put some, but not all, packing items in the weekly box")
    week, month = listing.prices.week, listing.prices.month
    if not (MIN_PRICE_PENCE <= week < month <= MAX_PRICE_PENCE):
        problems.append(f"prices must be in pence, between {MIN_PRICE_PENCE} and {MAX_PRICE_PENCE}, with weekly below monthly")
    if problems:
        raise ModelRetry("Please fix the listing: " + "; ".join(problems) + ".")
    return listing


def _prompt(idea: str, catalog: list[Box]) -> str:
    examples = [_example(box) for box in catalog if box.status == "active"][:2]
    others = [f"- {box.name}: {box.audience}. “{box.pitch}”" for box in catalog if box.status == "active"]
    return "\n".join(
        [
            f"Write the listing for a new box. The idea: {idea}",
            "",
            "Boxes already on sale (don't repeat them):",
            *(others or ["- none yet"]),
            "",
            "Listings in the house style, for tone and length:",
            json.dumps(examples, ensure_ascii=False, indent=1),
        ]
    )


def _example(box: Box) -> dict:
    data = box.model_dump(by_alias=True, include={"name", "audience", "tone", "pitch", "story", "shot_description", "prices", "plan_notes", "facts", "ritual", "contents"})
    data["items"] = [{"name": item.name, "inWeeklyBox": item.in_weekly_box} for item in box.items]
    return data


def _unique_sources(results: list[SearchResult]) -> list[dict]:
    seen: dict[str, dict] = {}
    for result in results:
        if result.url and result.url not in seen:
            seen[result.url] = {"title": result.title or result.url, "url": result.url}
    return list(seen.values())


class ListingNotConfigured(FailedPrecondition):
    def __init__(self) -> None:
        super().__init__("Listing drafts aren’t set up here yet: add OPENAI_API_KEY to functions/.env.")


class ListingFailed(FailedPrecondition):
    def __init__(self) -> None:
        super().__init__("Couldn’t draft that listing just now. Try again in a moment.")

