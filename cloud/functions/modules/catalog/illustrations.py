"""Draws a box's illustration with an OpenAI image model, for the box tile and the page's hero.

Photos stay separate (`Box.image`, uploaded by hand) and lead the box page's gallery.
The prompt is the brand's illustration brief, with the product description filled
in from the box: what it is, who it's for, the objects to draw and its colour.
The five launch boxes use the design's own SVGs instead (`public/illustrations/`).
"""
import base64
import logging
import uuid
from typing import Callable, Protocol
from urllib.parse import quote

from core import telemetry
from modules.catalog.catalog import Tone
from modules.shared.errors import FailedPrecondition

MAX_OBJECTS = 5
STORAGE_FOLDER = "boxes/illustrations"
# The storefront's --cream-0, so the picture's background melts into the card it sits on.
BACKGROUND_HEX = "#FFFDFA"

# Each tone's pastel, in the brief's own colour words.
TONE_COLOURS: dict[Tone, str] = {
    "blush": "dusty pink",
    "apricot": "peach",
    "sage": "sage green",
    "plum": "dusty mauve-pink",
    "lilac": "lavender",
    "cream": "butter yellow",
}

ILLUSTRATION_PROMPT = """\
Create a charming, minimalist 2D vector illustration representing:

{product_description}

STYLE:
Modern kawaii-inspired flat vector illustration, combining
Scandinavian minimalism with playful Japanese character design.
Inspired by contemporary lifestyle subscription brands.

COMPOSITION:
- Square 1:1 aspect ratio.
- Large, soft pastel-coloured circle centred in the background.
- A small floating beige shelf positioned across the lower third.
- Arrange 3–5 recognisable objects representing the product
  category on the shelf.
- Objects should have simple, rounded geometric silhouettes.
- Give 1–2 objects tiny, adorable faces with closed smiling
  eyes and rosy cheeks.
- Add 3–5 tiny decorative sparkles, stars or hearts.
- Keep everything balanced, spacious and visually cohesive.

ILLUSTRATION STYLE:
- Clean, flat 2D vector artwork.
- Soft, rounded shapes and simplified geometry.
- No outlines or very minimal outlines.
- Solid pastel fills with subtle tonal variations.
- No gradients, textures or realistic lighting.
- Minimal details, but instantly recognisable objects.
- Playful anthropomorphism, never childish or overly cartoonish.
- Consistent stroke weights and proportions.
- Gentle, friendly, contemporary aesthetic.

COLOUR PALETTE:
- Muted pastel colours: sage green, dusty pink, peach,
  lavender, butter yellow and warm cream.
- Choose one dominant pastel colour based on the product.
- Use 2–3 complementary colours for the objects.
- Warm beige shelf.
- Off-white background.
- Avoid saturated neon colours or harsh contrast.

LIGHTING & DEPTH:
- Mostly flat colours.
- Very subtle elliptical shadow beneath the shelf.
- Slight overlapping of objects to suggest depth.
- No 3D rendering or photorealism.

OUTPUT:
A polished, premium e-commerce category illustration.
Clean, adorable, sophisticated and instantly understandable.

IMPORTANT:
- Illustration only.
- No text, labels, prices, typography or borders.
- No realistic products or photographic elements.
- Maintain a consistent visual language suitable for
  an entire collection of subscription box categories.
"""


def product_description(name: str, audience: str, objects: list[str], tone: Tone) -> str:
    """The `{product_description}` slot: the box, who it's for, what to draw and its colour."""
    lines = [f"“{name}”, a subscription box{f' {audience[0].lower()}{audience[1:]}' if audience else ''}."]
    if objects:
        lines.append(f"Objects to draw on the shelf: {', '.join(objects[:MAX_OBJECTS])}.")
    lines.append(f"Dominant pastel colour: {TONE_COLOURS[tone]}. Background: flat off-white {BACKGROUND_HEX}, edge to edge.")
    return "\n".join(lines)


class ImageRenderer(Protocol):
    def __call__(self, prompt: str) -> bytes: ...


class OpenAIImages:
    """The only file that talks to OpenAI's image API, so tests can pass a fake renderer instead."""

    def __init__(self, api_key: str, model: str) -> None:
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key, timeout=170)
        self._model = model

    def __call__(self, prompt: str) -> bytes:
        result = self._client.images.generate(
            model=self._model, prompt=prompt, size="1024x1024", quality="medium", output_format="webp", n=1
        )
        return base64.b64decode(result.data[0].b64_json)


class StorageUploader:
    """Saves bytes to Cloud Storage and returns a Firebase download URL (public read, per storage.rules)."""

    def __init__(self, emulator_host: str | None = None) -> None:
        self._emulator_host = emulator_host

    def __call__(self, data: bytes, content_type: str, extension: str) -> str:
        from firebase_admin import storage

        bucket = storage.bucket()
        path = f"{STORAGE_FOLDER}/{uuid.uuid4()}.{extension}"
        token = str(uuid.uuid4())
        blob = bucket.blob(path)
        blob.metadata = {"firebaseStorageDownloadTokens": token}
        blob.upload_from_string(data, content_type=content_type)
        base = f"http://{self._emulator_host}" if self._emulator_host else "https://firebasestorage.googleapis.com"
        return f"{base}/v0/b/{bucket.name}/o/{quote(path, safe='')}?alt=media&token={token}"


class IllustrationService:
    def __init__(self, render: ImageRenderer, upload: Callable[[bytes, str, str], str]) -> None:
        self._render = render
        self._upload = upload

    def draw(self, data: dict) -> dict:
        """{name, audience, objects, tone} → {illustration: url}. Saves the picture but not the box."""
        name = " ".join(str(data.get("name") or "").split())
        if not name:
            raise ValueError("Give the box a name first, so there's something to draw.")
        tone = data.get("tone")
        if tone not in TONE_COLOURS:
            raise ValueError("Pick the box's colour first.")
        objects = [" ".join(str(item).split()) for item in data.get("objects") or [] if str(item).strip()]
        prompt = ILLUSTRATION_PROMPT.format(
            product_description=product_description(name, str(data.get("audience") or "").strip(), objects, tone)
        )
        try:
            image = self._render(prompt)
        except Exception as error:  # the model or its API: nothing the admin can fix but a retry
            telemetry.event("illustration_failed", level=logging.WARNING, name=name, error=repr(error))
            raise IllustrationFailed() from error
        url = self._upload(image, "image/webp", "webp")
        telemetry.event("illustration_drawn", name=name, objects=len(objects), bytes=len(image))
        return {"illustration": url}


class IllustrationsNotConfigured(FailedPrecondition):
    def __init__(self) -> None:
        super().__init__("Illustrations aren’t set up here yet: add OPENAI_API_KEY to functions/.env.")


class IllustrationFailed(FailedPrecondition):
    def __init__(self) -> None:
        super().__init__("Couldn’t draw that illustration just now. Try again in a moment.")
