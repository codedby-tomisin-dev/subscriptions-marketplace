import json
from typing import Any

from firebase_functions import https_fn


def make_success_response(data: Any, status: int = 200) -> https_fn.Response:
    """Returns a standardized JSON success response."""
    payload = data if isinstance(data, str) else json.dumps(data)
    return https_fn.Response(payload, status=status, headers={"Content-Type": "application/json"})


def make_error_response(message: str, status: int = 500, error: str | None = None) -> https_fn.Response:
    """Returns a standardized JSON error response."""
    try:
        # Check if message is already a JSON payload (e.g., from Pydantic ValidationError.json())
        json.loads(message)
        payload = message
    except ValueError:
        body = {"message": message}
        if error:
            body["error"] = error
        elif status == 400:
            body["error"] = "Bad Request"
        elif status == 404:
            body["error"] = "Not Found"
        elif status == 405:
            body["error"] = "Method Not Allowed"
        elif status >= 500:
            body["error"] = "Internal Server Error"

        payload = json.dumps(body)

    return https_fn.Response(payload, status=status, headers={"Content-Type": "application/json"})
