"""The one place Logfire is configured, plus the run-correlated tracing API.

See `.agent/rules/observability_standards.md`. App code imports `span`,
`event`, `run_scope`, `context` and `get_logger` from here and never imports
`logfire` directly.
"""
import logging
import secrets
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Any, Iterator

import logfire

span = logfire.span

_MAX_TEXT_LENGTH = 200

_run_id: ContextVar[str | None] = ContextVar("run_id", default=None)
_bound_fields: ContextVar[dict[str, Any]] = ContextVar("bound_fields", default={})


def setup_telemetry(*, send_to_logfire: bool | str) -> None:
    """Configures Logfire and routes every stdlib log line through it. Call once, from main.py.

    `send_to_logfire` is False under the emulator: instrumentation stays on, but the
    exporter's network threads would not survive the emulator forking its workers.
    """
    logfire.configure(service_name="bonbon-functions", send_to_logfire=send_to_logfire)

    root = logging.getLogger()
    if not any(isinstance(handler, logfire.LogfireLoggingHandler) for handler in root.handlers):
        root.addHandler(logfire.LogfireLoggingHandler())
    root.setLevel(logging.INFO)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


_logger = get_logger(__name__)


def _clip(value: Any) -> Any:
    if isinstance(value, str) and len(value) > _MAX_TEXT_LENGTH:
        return value[:_MAX_TEXT_LENGTH] + "…"
    return value


def event(name: str, /, level: int = logging.INFO, **fields: Any) -> None:
    """Logs `<name> run_id=… key=value …`, carrying the run id and any bound context fields."""
    merged = {"run_id": _run_id.get(), **_bound_fields.get(), **fields}
    parts = [f"{key}={_clip(value)}" for key, value in merged.items() if value is not None]
    _logger.log(level, " ".join([name, *parts]))


@contextmanager
def run_scope(kind: str, **fields: Any) -> Iterator[str]:
    """Opens one traced run: mints a run id, opens a span and brackets the body with start/end events."""
    run_id = secrets.token_hex(4)
    token = _run_id.set(run_id)
    try:
        with span("run {kind}", kind=kind, run_id=run_id, **fields):
            event("run_start", kind=kind, **fields)
            try:
                yield run_id
            finally:
                event("run_end", kind=kind)
    finally:
        _run_id.reset(token)


@contextmanager
def context(**fields: Any) -> Iterator[None]:
    """Binds fields (ids and kinds only, never PII) to every event and descendant span underneath."""
    present = {key: value for key, value in fields.items() if value is not None}
    token = _bound_fields.set({**_bound_fields.get(), **present})
    try:
        with logfire.set_baggage(**{key: str(value) for key, value in present.items()}):
            yield
    finally:
        _bound_fields.reset(token)
