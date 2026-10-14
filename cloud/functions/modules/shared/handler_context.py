"""Per-trigger handler decorators: one span, auth check and error mapping per Firebase entry point.

Apply them UNDER the Firebase trigger decorator. See `.agent/rules/observability_standards.md`.
Span attributes carry request-data keys, never values or auth claims.
"""
import functools
import logging
from typing import Any, Callable

from firebase_functions import https_fn

from core import telemetry
from modules.shared.errors import FailedPrecondition
from modules.shared.responses import make_error_response

logger = telemetry.get_logger(__name__)

ADMIN_ROLE = "admin"

CallableHandler = Callable[[https_fn.CallableRequest], Any]


def is_admin(auth: https_fn.AuthData | None) -> bool:
    return bool(auth and auth.token.get("role") == ADMIN_ROLE)


def _message(exc: Exception) -> str:
    # KeyError's str() wraps the message in quotes; args[0] is the text we raised.
    return str(exc.args[0]) if exc.args else exc.__class__.__name__


def _map_call_error(handler_name: str, exc: Exception) -> https_fn.HttpsError:
    codes = https_fn.FunctionsErrorCode
    if isinstance(exc, PermissionError):
        return https_fn.HttpsError(codes.PERMISSION_DENIED, _message(exc))
    if isinstance(exc, KeyError):
        return https_fn.HttpsError(codes.NOT_FOUND, _message(exc))
    if isinstance(exc, FailedPrecondition):
        return https_fn.HttpsError(codes.FAILED_PRECONDITION, _message(exc))
    if isinstance(exc, ValueError):
        return https_fn.HttpsError(codes.INVALID_ARGUMENT, _message(exc))
    logger.exception("unhandled error in %s", handler_name)
    return https_fn.HttpsError(codes.INTERNAL, "Something went wrong. Please try again.")


def _data_keys(data: Any) -> list[str]:
    return sorted(data.keys()) if isinstance(data, dict) else []


def traced_call(
    func: CallableHandler | None = None, *, require_auth: bool = True, require_admin: bool = False
) -> Any:
    """Wraps an `on_call` handler. Rejects unauthenticated (and, if asked, non-admin) callers first."""

    def decorate(handler: CallableHandler) -> CallableHandler:
        @functools.wraps(handler)
        def wrapper(req: https_fn.CallableRequest) -> Any:
            uid = req.auth.uid if req.auth else None
            with telemetry.run_scope("handler", handler=handler.__name__, data_keys=_data_keys(req.data)):
                with telemetry.context(uid=uid):
                    if (require_auth or require_admin) and not uid:
                        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNAUTHENTICATED, "Please sign in first.")
                    if require_admin and not is_admin(req.auth):
                        raise https_fn.HttpsError(https_fn.FunctionsErrorCode.PERMISSION_DENIED, "Admins only.")
                    try:
                        return handler(req)
                    except https_fn.HttpsError:
                        raise
                    except Exception as exc:
                        raise _map_call_error(handler.__name__, exc) from exc

        return wrapper

    return decorate(func) if func is not None else decorate


def traced_request(handler: Callable[[https_fn.Request], https_fn.Response]) -> Callable[[https_fn.Request], https_fn.Response]:
    """Wraps an `on_request` handler. The body builds its own success response; exceptions become JSON errors."""

    @functools.wraps(handler)
    def wrapper(req: https_fn.Request) -> https_fn.Response:
        with telemetry.run_scope("handler", handler=handler.__name__, method=req.method):
            try:
                return handler(req)
            except PermissionError as exc:
                return _rejected(handler.__name__, exc, 403)
            except KeyError as exc:
                return _rejected(handler.__name__, exc, 404)
            except ValueError as exc:
                return _rejected(handler.__name__, exc, 400)
            except Exception:
                logger.exception("unhandled error in %s", handler.__name__)
                return make_error_response("Internal error", status=500)

    return wrapper


def _rejected(name: str, exc: Exception, status: int) -> https_fn.Response:
    # Logged, since the caller is often a machine (Stripe) whose only clue is the status code.
    telemetry.event("request_rejected", level=logging.WARNING, handler=name, status=status, reason=_message(exc))
    return make_error_response(_message(exc), status=status)


def _swallowing(kind: str, handler: Callable[[Any], None]) -> Callable[[Any], None]:
    @functools.wraps(handler)
    def wrapper(event: Any) -> None:
        with telemetry.run_scope(kind, job=handler.__name__):
            try:
                handler(event)
            except Exception:
                # Never raise to Firebase: a failing schedule or trigger must not retry-storm.
                logger.exception("%s failed", handler.__name__)

    return wrapper


def traced_schedule(handler: Callable[[Any], None]) -> Callable[[Any], None]:
    """Wraps an `on_schedule` handler. Errors are recorded on the span and logged, never raised."""
    return _swallowing("cron", handler)


def traced_firestore(handler: Callable[[Any], None]) -> Callable[[Any], None]:
    """Wraps a Firestore trigger. Same swallow-and-log contract as `traced_schedule`."""
    return _swallowing("trigger", handler)
