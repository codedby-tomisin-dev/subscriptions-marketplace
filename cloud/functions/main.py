import os

import certifi

from firebase_admin import initialize_app
from firebase_functions.options import set_global_options

from core import config, telemetry
from utils import discover_handlers

if config.is_emulator():
    # The emulator forks a worker per request. On macOS, looking up system proxy
    # settings in a forked child crashes it (objc fork safety), and the HTTP
    # client behind Firebase Auth calls does that lookup unless a proxy env var is set.
    os.environ.setdefault("NO_PROXY", "*")
    # Same crash, other cause: the OpenAI SDK's HTTP client (httpx2) checks certificates
    # against the macOS keychain through Objective-C. A CA file makes it use plain OpenSSL.
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    # google-cloud-storage (behind firebase_admin.storage) only knows the emulator by this name.
    if config.storage_emulator_host():
        os.environ.setdefault("STORAGE_EMULATOR_HOST", f"http://{config.storage_emulator_host()}")

# Under the emulator the exporter stays off (see observability_standards.md);
# in production spans are exported only when LOGFIRE_TOKEN is set.
telemetry.setup_telemetry(send_to_logfire=False if config.is_emulator() else "if-token-present")

# For cost control, you can set the maximum number of containers that can be
# running at the same time. This helps mitigate the impact of unexpected
# traffic spikes by instead downgrading performance.
set_global_options(max_instances=10, region="us-central1")

initialize_app()

# Auto-discover and register all handlers from modules/*/handlers.py
globals().update(discover_handlers())
