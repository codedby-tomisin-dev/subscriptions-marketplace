---
trigger: always_on
---

# Observability (Logfire) — Authoring Standard

> This rule governs `cloud/functions` — any change that logs, traces, or adds a
> new Firebase entry point:
>
> - `cloud/functions/core/telemetry.py` — the one place Logfire is configured
>   (`setup_telemetry`) and the run-correlated tracing API (`event`, `run_scope`,
>   `context`, `span`, `traced_tool`, `get_logger`)
> - `cloud/functions/modules/shared/handler_context.py` — the per-trigger
>   handler decorators (`traced_call`, `traced_request`, `traced_schedule`,
>   `traced_firestore`)
> - every `modules/*/handlers.py`

---

## Governing Principle — One Telemetry System, No Silent Drops

A split telemetry setup is a common trap: agent/library spans reach Logfire
via their own instrumentation, but plain `logging.getLogger(__name__)` call
sites either go nowhere in prod (no stdlib handler installed) or print to
stdout only in local dev. `setup_telemetry()` avoids this by installing a
`LogfireLoggingHandler` on the *root* logger — every existing and future
`logger.info(...)` call reaches Logfire attached to whatever span is active,
with zero per-call-site migration.

**Rule: `logfire.configure(...)` and installing logging handlers happen in
exactly one place — `core.telemetry.setup_telemetry()`, called once from
`main.py`.** A second `configure()` call anywhere else silently fights it
(duplicate exporters, doubled logs). If you think you need to configure
Logfire somewhere else, you're solving a problem this file already solves —
extend `setup_telemetry`, don't call `logfire` directly.

---

## Getting a Logger

New code takes a logger via `core.telemetry.get_logger(__name__)`. It's a
plain `logging.getLogger` passthrough — the module-path name is what makes it
greppable and can't drift out of sync as files move. Existing
`logging.getLogger(...)` call sites work identically and don't need to switch.

```python
from core import telemetry

logger = telemetry.get_logger(__name__)
logger.info("fetched %d fixtures", len(fixtures))
```

---

## Run-Correlated Tracing — `event` / `run_scope` / `context` / `span`

A single run (a cron sweep, a manual fixture request, one inbound HTTP call)
fans out across tool calls, sub-agent runs, and per-user selection. Flat log
lines can't answer "why did this happen?" after the fact — nothing ties a
decision back to what produced it. `core.telemetry` fixes that with one
run-scoped id riding both a Logfire span (so nested spans join one trace) and
a contextvar (so `run_id=` shows up on every plain log line too).

- **`run_scope(kind, **fields)`** — open once, at the top of a run (e.g. inside
  a `traced_schedule`-wrapped handler, or a cron sweep). Mints an 8-hex
  `run_id`, opens a Logfire span, brackets the body with `run_start`/`run_end`
  events. `kind` names the trigger (`"cron"`, `"manual"`, `"handler"`). Nested
  scopes are safe — a manual run inside a cron sweep gets its own id but stays
  nested in the same trace.
- **`context(**fields)`** — bind extra fields (e.g. `uid=...`) to every `event`
  emitted underneath, for a stage that doesn't itself know who it's running
  for (selection is pure of user identity, but its log lines should still be
  attributable). Also attaches the fields as OTel baggage, so Logfire UI trace
  filtering by `uid` works across descendant spans.
- **`event(name, /, level=..., **fields)`** — emit one run-correlated line:
  `<name> run_id=… key=value …`. Prefer this over a raw `logger.info(...)` call
  for anything that should carry `run_id` and context fields automatically.
  `None` fields are dropped; free-text fields over 200 chars are clipped.
- **`span(...)`** — re-exported `logfire.span`. Use it (not `import logfire`
  directly) so app code has one telemetry import surface.
- **`traced_tool`** — wrap an agent tool to log its call/args/outcome under the
  run id. Purely observational: returns exactly what the tool returns, never
  raises on the tool's behalf.

```python
with telemetry.run_scope("cron", job="fetch_daily_fixtures"):
    with telemetry.context(uid=uid):
        telemetry.event("fixture_fetched", fixture_id=fx.id, source="livescore")
```

**Rule: don't reach for `import logfire` in app code.** Everything routine
needs — `span`, `event`, `run_scope`, `context` — is re-exported or wrapped by
`core.telemetry`. A bare `logfire.*` call site is a signal the wrapper is
missing something; extend `core/telemetry.py` instead of bypassing it.

---

## Firebase Handlers — Use the `traced_*` Decorator, Never Hand-Roll

Every Firebase entry point gets its span, auth check, and error-code mapping
from `modules.shared.handler_context`, applied **under** the Firebase trigger
decorator (Firebase computes the callable's registration name from
`func.__name__` at decoration time; `functools.wraps` keeps that intact):

| Trigger | Decorator | Contract |
|---|---|---|
| `https_fn.on_call` | `traced_call` (or `traced_call(require_auth=False)`) | Rejects unauthenticated calls before the body runs (default); domain exceptions (`PermissionError`, `KeyError`, `ValueError`) map to the matching `HttpsError` code, everything else → `INTERNAL` with a logged stack trace. |
| `https_fn.on_request` | `traced_request` | Body builds its own success response; exceptions become `make_error_response(...)`. |
| `scheduler_fn.on_schedule` | `traced_schedule` | Errors never raise out to Firebase — logged and swallowed after being recorded on the span. |
| `firestore_fn.on_document_written` | `traced_firestore` | Same swallow-and-log contract as scheduled — a write-triggered handler failing must never cause a retry storm. |

```python
@https_fn.on_call()
@traced_call
def approve_pick(req: https_fn.CallableRequest) -> dict:
    uid = req.auth.uid  # already validated by traced_call
    ...
```

**Rule: never write a new `_require_uid` or try/except → error-code block in a
handler.** That's what `traced_call`/`_map_call_error` are for — one
definition, reused everywhere. If a handler needs an error mapping
`_map_call_error` doesn't have, extend that function rather than special-casing
in the handler.

---

## PII — Keys and Shapes, Never Values

Span and baggage attributes carry request-data **keys** (`data_keys=[...]`),
never values, and never `req.auth.token` claims (email, name, …). This is
decided once, in `handler_context.py` and `core/telemetry.py`'s `_tool_detail`
helper — every handler and tool inherits it instead of re-deciding it per call
site.

**Rule: a new span/baggage attribute must be an id, an enum/kind, a count, or
a list of keys — never a request payload value, a user-entered string, or an
auth claim.** If you need to debug an actual value, log it at `DEBUG` via a
plain `logger.debug(...)` call (not a span attribute) and make sure that
logger isn't shipping to a shared/prod Logfire project, or scrub it before it
does.

---

## Checklist — Apply Before Every PR That Touches Logging/Tracing

```
[ ] 1. NO STRAY configure() / addHandler()
        Does this change call logfire.configure(...) or install a logging
        handler anywhere outside core.telemetry.setup_telemetry()? Move it in.

[ ] 2. NEW HANDLER USES traced_*
        Every new Firebase entry point (on_call/on_request/on_schedule/
        on_document_written) wrapped in the matching traced_* decorator,
        applied UNDER the Firebase decorator?

[ ] 3. NO HAND-ROLLED AUTH/ERROR MAPPING
        No new _require_uid-alike or try/except -> HttpsError block outside
        handler_context.py?

[ ] 4. PII CHECK
        Any new span/baggage/event field — is it an id/kind/count/key list,
        never a payload value or auth.token claim?

[ ] 5. RUN CORRELATION
        Does new fan-out logic (cron sweep, per-fixture loop, sub-agent
        dispatch) sit inside an existing run_scope, or does it need context(...)
        to bind identity for a stage that's otherwise anonymous?

[ ] 6. IMPORT SURFACE
        No bare `import logfire` in app code outside core/telemetry.py —
        span/event/run_scope/context cover the routine cases.
```

---

## Local Dev / Emulator — Exporter Off, Instrumentation On

A forked-worker local dev server (e.g. the Firebase emulator, or any process
that forks a worker per request) should configure Logfire with
`send_to_logfire=False` rather than skipping `setup_telemetry()` altogether —
instrumentation stays on (so span structure is identical to prod and you can
still see the trace tree locally), only the exporter is disabled. This isn't
just about reducing local noise: on macOS, a forked child inheriting live
exporter threads (which do DNS/network) can segfault, because
`Network.framework` is not fork-safe across `fork()`. Don't "fix" this by
turning the exporter back on for a forking local dev server — reproduce
locally with `send_to_logfire=False` and verify against Logfire in a real
deploy instead.
