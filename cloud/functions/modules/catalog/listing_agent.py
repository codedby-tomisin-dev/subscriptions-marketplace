"""Drafts a whole box listing from a one-line idea ("pet care"), for the admin to review.

It works from the experience, not the category: "breakfast" is a category; "a
breakfast from a different country every month" is worth paying for. So first
`angles()` suggests a few distinct experiences for the idea, the admin picks one
(or writes their own), and `draft()` writes the listing around it.

Every packing item gets used up within the delivery cycle (eaten, read, used,
worn out), so a subscription never piles up permanent things like a mug a month.

A PydanticAI agent on OpenAI returns a `GeneratedListing`. When a Parallel.ai key
is set it can first research the idea on the web, a few searches at most. Nothing
here saves anything: the draft fills the New box form, and the admin creates
the box from there.

The copy follows the design's five launch boxes (`starter_boxes.json`, the same copy
as the design's `mk-data.js`): simple, sweet and short, and written to Hormozi's value
equation, high dream outcome and likelihood, low time and effort. Word limits taken
from those boxes keep it short; a draft over them goes back to the model.

It never writes a testimonial. A made-up customer quote would read as a real review.
"""
import json
import logging
from dataclasses import dataclass, field
from typing import Literal

from pydantic import Field
from pydantic_ai import Agent, ModelRetry, RunContext

from core import telemetry
from modules.catalog.catalog import Box, Tone, starter_boxes
from modules.catalog.pricing import suggested_price_pence
from modules.shared.document import Document
from modules.shared.errors import FailedPrecondition
from third_party.parallel.client import ParallelSearchClient, SearchResult, digest

MAX_IDEA_LENGTH = 200
MAX_ANGLE_LENGTH = 400
ANGLE_COUNT = 4
MAX_SEARCHES = 4
# The range a drafted box's price may land in, in pence. Prices come from the item costs (see `pricing`).
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
    label: str = Field(
        description="Up to 6 words. One fact each: proof it's good ('Full-size, never samples'), how much you get "
        "('6 treats in the full box') or how little it asks of you ('About one lovely hour')."
    )


class ListingStep(Document):
    title: str = Field(description="Up to 4 words, an easy imperative, e.g. 'Open it together'.")
    body: str = Field(description="Up to 16 words. Show it's quick and easy, e.g. 'Lid off, glasses out. The first prompt card is already waiting on top.'")


class ListingContentsItem(Document):
    name: str = Field(description="Up to 4 words, what customers see in the box, e.g. 'Hand-poured candle'.")
    description: str = Field(description="Up to 7 words: a specific, sensory detail or a wink, e.g. 'Hard to kill, promise'.")
    tone: Tone = Field(description="Pastel for the placeholder tile; pick one that suits the item.")


# How long a packing item lasts once it arrives. Nothing outlasts a month: a subscription
# repeats, so anything permanent would pile up (a flashlight every month is silly).
ItemLifespan = Literal["one use", "about a week", "about a month"]


class ListingItem(Document):
    name: str = Field(description="A concrete thing to stock and pack, e.g. 'Shiraz 75cl'.")
    lifespan: ItemLifespan = Field(
        description="How soon it's eaten, drunk, read, used up or worn out. Only consumables and things with a short life."
    )
    in_weekly_box: bool = Field(description="Weekly boxes are smaller and only hold some items; monthly boxes hold all of them.")
    cost_pence: int = Field(
        description="What one costs to buy, in pence: the average shelf price across Tesco, Sainsbury's, Asda and Morrisons, e.g. 350 for £3.50."
    )


class ListingPlanNotes(Document):
    week: str = Field(description="Up to 8 words: a name for the smaller box, then the count, e.g. 'A mini date · 3 treats'.")
    month: str = Field(description="Up to 8 words: the full box, then the count, e.g. 'The full evening · 6 treats'.")


class GeneratedListing(Document):
    """Everything the New box form needs except the photo. Field names match the form."""

    name: str = Field(
        description="1–3 words, sentence case, naming the experience rather than the category, "
        "e.g. 'Breakfast passport' rather than 'Breakfast'."
    )
    audience: str = Field(description="Up to 6 words starting 'For': a person or a moment, e.g. 'For the 4pm slump'.")
    tone: Tone
    pitch: str = Field(
        description="The headline, up to 7 words: the dream outcome, already done for you, e.g. 'The 4pm slump, solved.'"
    )
    story: str = Field(
        description="Up to 30 words, two or three short sentences: the concrete things inside, the feeling, "
        "and that we do the work, e.g. 'We pack the calm — you just have to open it.'"
    )
    shot_description: str = Field(description="Up to 10 words of art direction for the hero photo: the key items, comma-separated.")
    plan_notes: ListingPlanNotes
    facts: list[ListingFact] = Field(description="3 or 4 highlights.")
    ritual: list[ListingStep] = Field(description="Exactly 3 steps for enjoying the box, in order.")
    contents: list[ListingContentsItem] = Field(description="4 to 6 things a full box typically holds.")
    items: list[ListingItem] = Field(description="4 to 8 packing items matching the contents.")


class ExperienceAngle(Document):
    title: str = Field(
        description="Up to 10 words: the experience itself, specific and repeatable, "
        "e.g. 'A breakfast from a different country, every month'."
    )
    promise: str = Field(
        description="Up to 25 words: what turns up and what they get to do with it, and what's new each delivery."
    )
    why: str = Field(description="Up to 15 words: why someone would happily pay for it again and again.")


class AngleSet(Document):
    angles: list[ExperienceAngle] = Field(description=f"Exactly {ANGLE_COUNT} clearly different experiences.")


@dataclass
class ResearchLog:
    """Per-run state for the search tool: its call count and every source it read."""

    searches: int = 0
    sources: list[SearchResult] = field(default_factory=list)


INSTRUCTIONS = """\
You write product listings for Bonbon, a UK subscription-box shop. Customers pick a
box and get it weekly or monthly. Each box is a small, physical treat, packed by hand.

The voice: simple, sweet and short. Match the five listings you're given; they are the
house style. British English, plain words, "you". No exclamation marks, no hype
("ultimate", "curated", "elevate", "indulge"). Every word earns its place.

Sell an experience, not a category. A breakfast box is a category; "a breakfast from
a different country every month" is an experience worth paying for. Every listing is
built around one specific experience: the name, pitch, story, ritual and contents all
deliver it, and each delivery brings something new within it.

Make the box obviously worth it, using Hormozi's value equation:
value = (dream outcome × likelihood it happens) / (time it takes × effort it asks).
- Dream outcome up: the pitch names the result the customer wants, as if it's done
  ("A slower Sunday, delivered." "The 4pm slump, solved.").
- Likelihood up: be specific. Real counts ("14 snacks in the full box"), concrete,
  sensory details ("Fig and cedar, 40-hour burn"), full-size things, a reason it suits them.
- Time down: it arrives at the door, ready the moment the lid's off. Rituals take minutes.
- Effort down: we choose, pack and send everything; nothing to plan, buy or assemble.
  Say so plainly ("We pack the calm — you just have to open it.").

Rules:
- Everything must be things we could really buy and pack in the UK. No brand names.
- Specific, never invented: no made-up ratings, reviews, certifications or claims like
  "vet-approved" or "award-winning". Never put what the contents cost in the copy.
- Cost each packing item at its average UK supermarket shelf price (costPence): what a
  shopper would pay for it. Each plan's price is worked out from those costs (the goods,
  plus 30% for the experience, plus delivery and packaging), so cost them accurately and
  fill each box generously enough to feel worth its price.
- Everything in the box gets used up within its delivery cycle: eaten, drunk, read,
  used up or worn out. A subscription repeats, so nothing permanent that would pile up:
  no tools, gadgets, mugs, dishes, games or ornaments. A book box sends a new book each
  time (read once); a plant box sends seeds, plant food and cuttings, not a torch or a
  trowel. This applies to the contents customers see and to the packing items.
- Weekly boxes are a smaller version of the monthly box; price them like the examples.
- Make the box clearly different from the boxes already on sale.
"""

RESEARCH_INSTRUCTIONS = """
Before writing, use web_search a couple of times (at most {limit}) to learn what people
who'd want this box actually love, which products are typical for it in the UK, and
what they cost at the big supermarkets.
Ask plain-language questions. Then write the listing from what you learned.
"""


ANGLE_INSTRUCTIONS = """\
You come up with box ideas for Bonbon, a UK subscription-box shop: small physical boxes,
packed by hand, sent weekly or monthly.

Given a rough idea, suggest {count} clearly different experiences a box could deliver.
Sell the experience, not the category: "breakfast box" is a category; "a breakfast from
a different country every month" is an experience. Each one should:
- be specific and repeatable, with something new in every delivery (a country, a
  season, a chapter, a challenge, a theme), so it's worth having again and again;
- be built from things that get used up within a month (eaten, read, used up), never
  permanent things that would pile up;
- be clearly different from the others and from the boxes already on sale.
British English, plain words, no hype, no exclamation marks.
"""


class ListingAgent:
    """`model` is a PydanticAI model (OpenAI in production, a TestModel in tests)."""

    def __init__(self, model: object, search: ParallelSearchClient | None = None, max_searches: int = MAX_SEARCHES) -> None:
        self._model = model
        self._search = search if search and search.available else None
        self._max_searches = max_searches

    def angles(self, idea: str, catalog: list[Box]) -> dict:
        """{idea} → {angles: [{title, promise, why}]}: experiences to build the box around. No research, so it's quick."""
        idea = _clean_idea(idea)
        agent = Agent(
            self._model,
            output_type=AngleSet,
            instructions=ANGLE_INSTRUCTIONS.format(count=ANGLE_COUNT),
            name="angle_agent",
            output_retries=3,
        )
        agent.output_validator(_check_angles)
        try:
            result = agent.run_sync(_angle_prompt(idea, catalog))
        except Exception as error:  # the model or its API: nothing the admin can fix but a retry
            telemetry.event("angles_failed", level=logging.WARNING, idea=idea, error=repr(error))
            raise ListingFailed() from error
        telemetry.event("angles_suggested", idea=idea, count=len(result.output.angles))
        return {"angles": [angle.model_dump(by_alias=True) for angle in result.output.angles]}

    def draft(self, idea: str, catalog: list[Box], angle: str | None = None) -> dict:
        """{idea, angle?} → {listing: the New box form's fields, sources: [{title, url}]}.
        `angle` is the experience to build it around, picked from `angles()` or written by the admin."""
        idea = _clean_idea(idea)
        angle = " ".join((angle or "").split()) or None
        if angle and len(angle) > MAX_ANGLE_LENGTH:
            raise ValueError(f"Keep the experience under {MAX_ANGLE_LENGTH} characters.")

        research = ResearchLog()
        try:
            result = self._agent().run_sync(_prompt(idea, catalog, angle), deps=research)
        except Exception as error:  # the model or its API: nothing the admin can fix but a retry
            telemetry.event("listing_draft_failed", level=logging.WARNING, idea=idea, error=repr(error))
            raise ListingFailed() from error
        listing: GeneratedListing = result.output
        telemetry.event("listing_drafted", idea=idea, angle=angle, name=listing.name, searches=research.searches)
        return {
            "listing": {
                **listing.model_dump(by_alias=True),
                "prices": _prices(listing),
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


def _clean_idea(idea: str) -> str:
    idea = " ".join(idea.split())
    if not idea:
        raise ValueError("Describe the idea for the box, e.g. “pet care”.")
    if len(idea) > MAX_IDEA_LENGTH:
        raise ValueError(f"Keep the idea under {MAX_IDEA_LENGTH} characters.")
    return idea


ANGLE_WORD_LIMITS = {"title": 10, "promise": 25, "why": 15}


def _check_angles(result: AngleSet) -> AngleSet:
    problems = []
    if len(result.angles) != ANGLE_COUNT:
        problems.append(f"give exactly {ANGLE_COUNT} angles")
    titles = [angle.title.strip().lower() for angle in result.angles]
    if len(set(titles)) != len(titles):
        problems.append("make every angle different")
    for i, angle in enumerate(result.angles):
        for field_name, limit in ANGLE_WORD_LIMITS.items():
            text = getattr(angle, field_name)
            if len(text.split()) > limit:
                problems.append(f"shorten angles[{i}].{field_name} to {limit} words or fewer (now: “{text}”)")
    if problems:
        raise ModelRetry("Please fix the angles: " + "; ".join(problems) + ".")
    return result


def _goods_pence(listing: GeneratedListing, cadence: str) -> int:
    return sum(item.cost_pence for item in listing.items if cadence == "month" or item.in_weekly_box)


def _prices(listing: GeneratedListing) -> dict[str, int]:
    """Each plan's price, from what its goods cost (see `pricing`)."""
    return {cadence: suggested_price_pence(_goods_pence(listing, cadence)) for cadence in ("week", "month")}


def _check_listing(listing: GeneratedListing) -> GeneratedListing:
    """Counts, prices and lengths the schema can't express. A failure sends the model back to fix it."""
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
    problems.extend(_too_long(listing))
    if any(item.cost_pence <= 0 for item in listing.items):
        problems.append("give every packing item its average supermarket price in pence")
    else:
        for cadence, price in _prices(listing).items():
            if not MIN_PRICE_PENCE <= price <= MAX_PRICE_PENCE:
                problems.append(
                    f"the {cadence}ly box would cost the customer {price}p; keep it between {MIN_PRICE_PENCE}p and "
                    f"{MAX_PRICE_PENCE}p by changing what goes in it"
                )
    if problems:
        raise ModelRetry("Please fix the listing: " + "; ".join(problems) + ".")
    return listing


# Word limits per field: the longest copy in the design's five boxes, plus a little slack.
WORD_LIMITS = {
    "name": 3, "audience": 6, "pitch": 7, "story": 30, "shot_description": 10, "plan_notes": 8,
    "facts": 6, "ritual_title": 4, "ritual_body": 16, "contents_name": 4, "contents_description": 7,
}  # fmt: skip


def _too_long(listing: GeneratedListing) -> list[str]:
    """One problem per field that runs over its word limit, quoting the offending text."""
    fields: list[tuple[str, str, str]] = [
        ("name", "name", listing.name),
        ("audience", "audience", listing.audience),
        ("pitch", "pitch", listing.pitch),
        ("story", "story", listing.story),
        ("shot_description", "shotDescription", listing.shot_description),
        ("plan_notes", "planNotes.week", listing.plan_notes.week),
        ("plan_notes", "planNotes.month", listing.plan_notes.month),
        *(("facts", f"facts[{i}]", fact.label) for i, fact in enumerate(listing.facts)),
        *(("ritual_title", f"ritual[{i}].title", step.title) for i, step in enumerate(listing.ritual)),
        *(("ritual_body", f"ritual[{i}].body", step.body) for i, step in enumerate(listing.ritual)),
        *(("contents_name", f"contents[{i}].name", item.name) for i, item in enumerate(listing.contents)),
        *(("contents_description", f"contents[{i}].description", item.description) for i, item in enumerate(listing.contents)),
    ]
    return [
        f"shorten {where} to {WORD_LIMITS[kind]} words or fewer (now: “{text}”)"
        for kind, where, text in fields
        if len(text.split()) > WORD_LIMITS[kind]
    ]


def _on_sale(catalog: list[Box]) -> list[str]:
    return [f"- {box.name}: {box.audience}. “{box.pitch}”" for box in catalog if box.status == "active"] or ["- none yet"]


def _angle_prompt(idea: str, catalog: list[Box]) -> str:
    return "\n".join([f"The idea: {idea}", "", "Boxes already on sale:", *_on_sale(catalog)])


def _prompt(idea: str, catalog: list[Box], angle: str | None = None) -> str:
    # Always the design's five boxes: the live catalog can drift from the house style.
    examples = [_example(box) for box in starter_boxes()]
    experience = (
        [f"The experience to build it around: {angle}", "Every part of the listing should deliver this experience.", ""]
        if angle
        else ["Pick the most compelling specific experience for this idea, and build the listing around it.", ""]
    )
    return "\n".join(
        [
            f"Write the listing for a new box. The idea: {idea}",
            *experience,
            "Boxes already on sale (don't repeat them):",
            *_on_sale(catalog),
            "",
            "The house style: match these listings' tone, structure and length. They're for the voice only:",
            "they predate the rule that everything is used up, so don't copy their contents.",
            json.dumps(examples, ensure_ascii=False, indent=1),
        ]
    )


def _example(box: Box) -> dict:
    # No packing items: some of the launch boxes' are permanent (a card game, socks), which drafts mustn't copy.
    return box.model_dump(by_alias=True, include={"name", "audience", "tone", "pitch", "story", "shot_description", "plan_notes", "facts", "ritual", "contents"})


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

