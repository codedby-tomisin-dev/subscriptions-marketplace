"""The one config module. Read settings from here, never with os.getenv elsewhere.

Values come from `functions/.env`, which Firebase loads into the environment
both under the emulator and when deployed (plus `.env.<project-id>` overrides).
"""
import os

from firebase_functions.params import StringParam

# Where Stripe Checkout sends customers back to.
APP_BASE_URL = StringParam("APP_BASE_URL", default="http://localhost:3000")


def stripe_secret_key() -> str:
    return os.getenv("STRIPE_SECRET_KEY", "")


def stripe_webhook_secret() -> str:
    return os.getenv("STRIPE_WEBHOOK_SECRET", "")


def openai_api_key() -> str:
    return os.getenv("OPENAI_API_KEY", "")


def listing_model() -> str:
    """The OpenAI model that drafts box listings in the admin."""
    return os.getenv("OPENAI_LISTING_MODEL") or "gpt-5.6-luna"


def parallel_search_api_key() -> str:
    """Parallel.ai web search, used by the listing agent to research an idea. Optional."""
    return os.getenv("PARALLEL_SEARCH_API_KEY", "")


def is_emulator() -> bool:
    return os.getenv("FUNCTIONS_EMULATOR") == "true"
