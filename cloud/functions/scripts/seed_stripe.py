"""Creates (or updates) the Stripe products and prices for the starter boxes. Safe to re-run.

Boxes created or edited in the admin sync their own prices when saved; this is for a fresh Stripe account.

    venv/bin/python scripts/seed_stripe.py     # reads STRIPE_SECRET_KEY from functions/.env

Prices are found by lookup key (`snacks_week`, ...). If a catalog price changes,
a new Stripe price takes over the lookup key; existing subscribers keep theirs.
"""
import os
import sys
from pathlib import Path

from dotenv import dotenv_values

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from modules.billing.gateway import StripeGateway  # noqa: E402
from modules.catalog.catalog import starter_boxes  # noqa: E402

ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


def read_secret_key() -> str:
    key = os.getenv("STRIPE_SECRET_KEY") or dotenv_values(ENV_FILE).get("STRIPE_SECRET_KEY")
    if not key or not key.startswith("sk_test_"):
        raise SystemExit("Set STRIPE_SECRET_KEY to a test-mode key (sk_test_...).")
    return key


def sync_starter_prices(gateway: StripeGateway) -> None:
    for box in starter_boxes():
        changed = gateway.sync_box_prices(box.id, box.name, dict(box.prices))
        print(f"  {box.id}: {'new prices for ' + ', '.join(changed) if changed else 'up to date'}")


def main() -> None:
    sync_starter_prices(StripeGateway(read_secret_key()))
    print("Stripe catalog ready.")


if __name__ == "__main__":
    main()
