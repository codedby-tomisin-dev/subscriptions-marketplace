import sys
from pathlib import Path

# Tests import modules the way main.py does: relative to the functions root.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import telemetry  # noqa: E402

telemetry.setup_telemetry(send_to_logfire=False)

import os  # noqa: E402
import urllib.request  # noqa: E402

import pytest  # noqa: E402

EMULATOR_PROJECT = "demo-bonbon"


@pytest.fixture
def db():
    """A clean Firestore emulator database. Run via `npm run test:functions` in /cloud."""
    host = os.getenv("FIRESTORE_EMULATOR_HOST")
    if not host:
        pytest.skip("needs the Firestore emulator (npm run test:functions)")
    from google.cloud import firestore

    url = f"http://{host}/emulator/v1/projects/{EMULATOR_PROJECT}/databases/(default)/documents"
    urllib.request.urlopen(urllib.request.Request(url, method="DELETE"))
    return firestore.Client(project=EMULATOR_PROJECT)
