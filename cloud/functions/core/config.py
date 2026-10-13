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


def is_emulator() -> bool:
    return os.getenv("FUNCTIONS_EMULATOR") == "true"
