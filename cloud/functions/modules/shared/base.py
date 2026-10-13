import json
import inspect
from typing import Generic, TypeVar, Any, Callable
from firebase_admin import firestore
from firebase_functions import https_fn, options
from pydantic import BaseModel, ValidationError

from modules.shared.service import BaseService
from modules.shared.responses import make_success_response, make_error_response

T = TypeVar("T", bound=BaseModel)


def _parse_expand(expand_raw: str | list | None) -> set[str] | None:
    """
    Parses the `expand` request parameter into a set of field names for _hydrate.

    Accepts:
        None / ""         → None  (no hydration — fast path)
        "*" or "all"      → {"__all__"} (expand every ref field)
        "products"        → {"products"}
        "products,currency" → {"products", "currency"}
        ["products"]      → {"products"}  (callable path may send a list)
    """
    if not expand_raw:
        return None
    if isinstance(expand_raw, list):
        names = {n.strip() for n in expand_raw if n.strip()}
    else:
        names = {n.strip() for n in expand_raw.split(",") if n.strip()}
    if names & {"*", "all"}:
        return {"__all__"}
    return names or None


def http_action(*methods: str, requires_id: bool = False, status: int = 200) -> Callable:
    """
    Marks a _do_* method as an HTTP-dispatchable action.

    Args:
        *methods:    HTTP verbs this handler accepts (e.g. "GET", "POST").
        requires_id: If True, only dispatched when `id` is present in query params.
        status:      Success HTTP status code (default 200; use 201 for create).

    Usage:
        @http_action("GET")
        def _do_list(self, data: dict) -> dict: ...

        @http_action("GET", requires_id=True)
        def _do_get(self, data: dict) -> dict: ...
    """
    def decorator(fn: Callable) -> Callable:
        fn._http_action = {  # type: ignore[attr-defined]
            "methods": [m.upper() for m in methods],
            "requires_id": requires_id,
            "status": status,
        }
        return fn
    return decorator


def callable_action(name: str) -> Callable:
    """
    Marks a _do_* method as a dispatchable callable action under `name`.

    The decorated function receives the full `data: dict` payload and is
    responsible for extracting its own arguments.

    Usage:
        @callable_action("list")
        def _do_list(self, data: dict) -> dict: ...
    """
    def decorator(fn: Callable) -> Callable:
        fn._callable_action = name  # type: ignore[attr-defined]
        return fn
    return decorator


class BaseCRUDHandler(Generic[T]):
    """
    Unified CRUD handler for Firebase Functions.

    Core ops live in _do_* methods, each tagged with one or both decorators:
      - @http_action(*methods)      — registers the method in handle_request's dispatch table
      - @callable_action("name")   — registers the method in handle_callable's dispatch table

    Both handle_request and handle_callable discover their tables at construction
    time. Adding a new operation requires only a new decorated _do_* method.
    """

    def __init__(self, service_cls: type[BaseService[T]], repo_cls: type[Any], model_cls: type[T]) -> None:
        self.service_cls = service_cls
        self.repo_cls = repo_cls
        self.model_cls = model_cls
        self._build_dispatch_tables()

    def _build_dispatch_tables(self) -> None:
        """Scans for decorated methods and builds HTTP + callable dispatch tables."""
        self._http_actions: dict[tuple[str, bool], tuple[Callable, int]] = {}
        self._callable_actions: dict[str, Callable] = {}

        for _, method in inspect.getmembers(self, predicate=inspect.ismethod):
            if hasattr(method, "_http_action"):
                meta = method._http_action
                for verb in meta["methods"]:
                    self._http_actions[(verb, meta["requires_id"])] = (method, meta["status"])

            if hasattr(method, "_callable_action"):
                self._callable_actions[method._callable_action] = method

    def register_functions(self, name: str) -> dict[str, Callable]:
        """
        Creates and returns Firebase-decorated functions for this handler.

        Injects two entries into the caller's module globals:
          - `name`            → @https_fn.on_request() wrapping handle_request
          - `callable_{name}` → @https_fn.on_call()    wrapping handle_callable

        Usage (at module level):
            globals().update(product_handler.register_functions("products"))
        """
        handler = self

        def _http_fn(req: https_fn.Request) -> https_fn.Response:
            return handler.handle_request(req)

        def _callable_fn(req: https_fn.CallableRequest) -> dict:
            return handler.handle_callable(req)

        _http_fn.__name__ = name
        _callable_fn.__name__ = f"callable_{name}"

        cors_opts = options.CorsOptions(
            cors_origins="*",
            cors_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        )
        return {
            name: https_fn.on_request(cors=cors_opts, timeout_sec=540)(_http_fn),
            f"callable_{name}": https_fn.on_call(cors=cors_opts, timeout_sec=540)(_callable_fn),
        }

    def _get_service(self) -> BaseService[T]:
        """Instantiates the service with a fresh Firestore client."""
        db = firestore.client()
        repo = self.repo_cls(db=db)
        return self.service_cls(repo=repo)

    # ── Shared core operations ───

    @http_action("GET")
    @callable_action("list")
    def _do_list(self, data: dict) -> dict:
        page = int(data.get("page", 1))
        limit = int(data.get("limit", 10))
        filters = data.get("filters")
        expand = _parse_expand(data.get("expand"))
        sort_by = data.get("sort_by", "created_at")
        order = data.get("order", "DESCENDING")

        service = self._get_service()
        items = service.list(page=page, limit=limit, filters=filters, expand=expand, sort_by=sort_by, order=order)
        serialized = [json.loads(i.model_dump_json()) for i in items]
        return {"data": serialized, "page": page, "limit": limit}

    @http_action("GET", requires_id=True)
    @callable_action("get")
    def _do_get(self, data: dict) -> dict:
        item_id = data.get("id")
        if not item_id:
            raise ValueError("Missing 'id'.")
        service = self._get_service()
        item = service.get(item_id)
        if not item:
            raise KeyError(f"Item '{item_id}' not found.")
        return json.loads(item.model_dump_json())

    @http_action("POST", status=201)
    @callable_action("create")
    def _do_create(self, data: dict) -> dict:
        instance = self.model_cls(**{k: v for k, v in data.items() if k != "action"})
        service = self._get_service()
        created = service.create(instance)
        return json.loads(created.model_dump_json())

    @http_action("PUT", "PATCH", requires_id=True)
    @callable_action("update")
    def _do_update(self, data: dict) -> dict:
        item_id = data.get("id")
        if not item_id:
            raise ValueError("Missing 'id'.")
        payload = {k: v for k, v in data.items() if k not in ("action", "id")}
        service = self._get_service()
        updated = service.update(item_id, payload)
        return json.loads(updated.model_dump_json())

    @http_action("DELETE", requires_id=True)
    @callable_action("delete")
    def _do_delete(self, data: dict) -> dict:
        item_id = data.get("id")
        if not item_id:
            raise ValueError("Missing 'id'.")
        service = self._get_service()
        service.delete(item_id)
        return {"success": True}

    @callable_action("get_by_key")
    def _do_get_by_key(self, data: dict) -> dict:
        key = data.get("key")
        if not key:
            raise ValueError("Missing 'key'.")
        repo = self.repo_cls(db=firestore.client())
        item = repo.get_by_key(key)
        if not item:
            raise KeyError(f"Item with key '{key}' not found.")
        return json.loads(item.model_dump_json())

    @callable_action("get_by_slug")
    def _do_get_by_slug(self, data: dict) -> dict:
        slug = data.get("slug")
        if not slug:
            raise ValueError("Missing 'slug'.")
        repo = self.repo_cls(db=firestore.client())
        if not hasattr(repo, "get_by_slug"):
            raise NotImplementedError("This resource does not support lookup by slug.")
        item = repo.get_by_slug(slug)
        if not item:
            raise KeyError(f"Item with slug '{slug}' not found.")
        return json.loads(item.model_dump_json())

    def handle_request(self, req: https_fn.Request) -> https_fn.Response:
        """
        Routes an HTTP request via the @http_action dispatch table.
        Dispatch key: (HTTP_METHOD, bool(id in query params)).
        """
        method = req.method.upper()
        has_id = bool(req.args.get("id"))

        # Prefer specific (method, True) match, fall back to (method, False)
        entry = self._http_actions.get((method, has_id)) or self._http_actions.get((method, False))

        if not entry:
            allowed = sorted({m for m, _ in self._http_actions})
            return make_error_response(f"Method Not Allowed. Allowed: {', '.join(allowed)}", status=405)

        handler, success_status = entry

        # Build a unified data dict from the request
        data: dict = dict(req.args)
        body = req.get_json(silent=True)
        if body and isinstance(body, dict):
            data.update(body)

        try:
            return make_success_response(handler(data), status=success_status)
        except ValidationError as e:
            return make_error_response(e.json(), status=400)
        except (KeyError, ValueError) as e:
            return make_error_response(str(e), status=404 if isinstance(e, KeyError) else 400)
        except NotImplementedError as e:
            return make_error_response(str(e), status=501)
        except Exception as e:
            return make_error_response(str(e))

    def handle_callable(self, req: https_fn.CallableRequest) -> dict:
        """
        Dispatches to the @callable_action method matching req.data['action'].
        Adding a new action requires only a @callable_action-decorated method.
        """
        data = req.data or {}
        action = data.get("action")
        handler = self._callable_actions.get(action)  # type: ignore[arg-type]

        if not handler:
            valid = ", ".join(sorted(self._callable_actions))
            raise https_fn.HttpsError(
                https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
                f"Unknown action '{action}'. Valid actions: {valid}.",
            )

        try:
            return handler(data)
        except https_fn.HttpsError:
            raise
        except KeyError as e:
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.NOT_FOUND, str(e))
        except NotImplementedError as e:
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.UNIMPLEMENTED, str(e))
        except (ValidationError, ValueError) as e:
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INVALID_ARGUMENT, str(e))
        except Exception as e:
            raise https_fn.HttpsError(https_fn.FunctionsErrorCode.INTERNAL, str(e))
