import pytest

from modules.catalog import handlers
from modules.catalog.illustrations import IllustrationFailed, IllustrationService, IllustrationsNotConfigured, product_description


class Recorder:
    def __init__(self) -> None:
        self.prompts: list[str] = []
        self.uploads: list[tuple[bytes, str, str]] = []

    def render(self, prompt: str) -> bytes:
        self.prompts.append(prompt)
        return b"webp-bytes"

    def upload(self, data: bytes, content_type: str, extension: str) -> str:
        self.uploads.append((data, content_type, extension))
        return "https://storage.example/boxes/illustrations/pic.webp"


PET_CARE = {"name": "Pet care", "audience": "For the dog who has everything", "tone": "sage", "objects": ["Rope toy", "Treat tin", "Bandana"]}


def test_fills_the_brief_and_uploads_the_picture():
    recorder = Recorder()
    result = IllustrationService(recorder.render, recorder.upload).draw(PET_CARE)

    assert result == {"illustration": "https://storage.example/boxes/illustrations/pic.webp"}
    assert recorder.uploads == [(b"webp-bytes", "image/webp", "webp")]
    prompt = recorder.prompts[0]
    assert prompt.startswith("Create a charming, minimalist 2D vector illustration representing:")
    assert "“Pet care”, a subscription box for the dog who has everything." in prompt
    assert "Objects to draw on the shelf: Rope toy, Treat tin, Bandana." in prompt
    assert "Dominant pastel colour: sage green." in prompt
    assert "No text, labels, prices, typography or borders." in prompt


def test_draws_at_most_five_objects():
    description = product_description("Snacks", "", [f"thing {n}" for n in range(8)], "apricot")
    assert "thing 4." in description and "thing 5" not in description
    assert description.startswith("“Snacks”, a subscription box.")


@pytest.mark.parametrize("data", [{**PET_CARE, "name": "  "}, {**PET_CARE, "tone": "neon"}])
def test_needs_a_name_and_a_colour(data):
    recorder = Recorder()
    with pytest.raises(ValueError):
        IllustrationService(recorder.render, recorder.upload).draw(data)
    assert recorder.prompts == []


def test_a_model_failure_becomes_a_friendly_error_and_uploads_nothing():
    recorder = Recorder()

    def broken(prompt: str) -> bytes:
        raise RuntimeError("content policy")

    with pytest.raises(IllustrationFailed, match="Try again"):
        IllustrationService(broken, recorder.upload).draw(PET_CARE)
    assert recorder.uploads == []


def test_no_openai_key_says_how_to_set_it_up(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    with pytest.raises(IllustrationsNotConfigured, match="OPENAI_API_KEY"):
        handlers.build_illustration_service()
