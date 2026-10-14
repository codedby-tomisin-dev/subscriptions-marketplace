from types import SimpleNamespace

import pytest
from firebase_functions import https_fn

from modules.shared.errors import FailedPrecondition
from modules.shared.handler_context import traced_call, traced_request, traced_schedule


def make_request(uid: str | None = "maya", role: str | None = None, data: dict | None = None):
    auth = None
    if uid:
        auth = SimpleNamespace(uid=uid, token={"role": role} if role else {})
    return SimpleNamespace(auth=auth, data=data or {})


def error_code(handler, req) -> str:
    with pytest.raises(https_fn.HttpsError) as caught:
        handler(req)
    return caught.value.code.value


def test_rejects_signed_out_callers_before_running():
    ran = []

    @traced_call
    def handler(req):
        ran.append(True)

    assert error_code(handler, make_request(uid=None)) == "unauthenticated"
    assert ran == []


def test_admin_handlers_reject_customers_and_accept_admins():
    @traced_call(require_admin=True)
    def handler(req):
        return {"ok": True}

    assert error_code(handler, make_request()) == "permission-denied"
    assert handler(make_request(role="admin")) == {"ok": True}


@pytest.mark.parametrize(
    ("exc", "code"),
    [
        (PermissionError("not yours"), "permission-denied"),
        (KeyError("no such subscription"), "not-found"),
        (ValueError("bad cadence"), "invalid-argument"),
        (FailedPrecondition("not paused"), "failed-precondition"),
        (RuntimeError("boom"), "internal"),
    ],
)
def test_maps_domain_errors_to_callable_codes(exc, code):
    @traced_call
    def handler(req):
        raise exc

    assert error_code(handler, make_request()) == code


def test_not_found_message_has_no_stray_quotes():
    @traced_call
    def handler(req):
        raise KeyError("No such subscription")

    with pytest.raises(https_fn.HttpsError) as caught:
        handler(make_request())
    assert caught.value.message == "No such subscription"


def test_keeps_the_handler_name_for_firebase_registration():
    @traced_call
    def manage_subscription(req):
        pass

    assert manage_subscription.__name__ == "manage_subscription"


def test_scheduled_handlers_swallow_errors():
    @traced_schedule
    def nightly(event):
        raise RuntimeError("boom")

    nightly(None)


def test_rejected_requests_are_logged_with_their_reason(monkeypatch):
    logged = []
    monkeypatch.setattr("core.telemetry.event", lambda name, **fields: logged.append((name, fields)))

    @traced_request
    def webhook(req):
        raise ValueError("Invalid Stripe signature")

    response = webhook(SimpleNamespace(method="POST"))
    assert response.status_code == 400
    rejected = [fields for name, fields in logged if name == "request_rejected"]
    assert rejected == [{"level": rejected[0]["level"], "handler": "webhook", "status": 400, "reason": "Invalid Stripe signature"}]
