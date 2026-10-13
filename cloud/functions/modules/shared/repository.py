from typing import Any, Dict, Generic, List, Tuple, TypeVar, get_args, get_origin
import uuid
from slugify import slugify

from google.cloud.firestore import Client
from google.cloud.firestore_v1.base_vector_query import DistanceMeasure
from google.cloud.firestore_v1.vector import Vector
from pydantic import BaseModel as _BaseModel

from modules.shared.fields import EmbeddingField, RefField, UniqueField


T = TypeVar("T")


def _extract_ref_field(annotation: Any) -> RefField | None:
    """Returns the RefField metadata from an Annotated type, or None."""
    if get_origin(annotation) is not None:
        for arg in get_args(annotation):
            if isinstance(arg, RefField):
                return arg
    return None


def _find_direct_ref(field_info: Any) -> RefField | None:
    """Returns the RefField from direct Annotated metadata, or None."""
    for meta in field_info.metadata:
        if isinstance(meta, RefField):
            return meta
    return None


def _find_list_ref(annotation: Any) -> RefField | None:
    """Returns the RefField if the annotation is list[Annotated[str, RefField(...)]], or None."""
    if get_origin(annotation) is not list:
        return None
    inner_args = get_args(annotation)
    if not inner_args:
        return None
    return _extract_ref_field(inner_args[0])


def _get_ref_fields(model_cls: type) -> dict[str, tuple[RefField, bool]]:
    """
    Inspects a Pydantic model's fields and returns:
        {field_name: (RefField instance, is_list)}

    Handles both:
        brand: Annotated[str, RefField(Brand)]            → is_list=False
        products: list[Annotated[str, RefField(Product)]] → is_list=True
    """
    result: dict[str, tuple[RefField, bool]] = {}

    for field_name, field_info in model_cls.model_fields.items():
        direct = _find_direct_ref(field_info)
        if direct:
            result[field_name] = (direct, False)
            continue

        list_ref = _find_list_ref(field_info.annotation)
        if list_ref:
            result[field_name] = (list_ref, True)

    return result


def _get_embedding_fields(model_cls: type) -> list[str]:
    """Returns field names annotated with EmbeddingField on the given model."""
    result: list[str] = []
    for field_name, field_info in model_cls.model_fields.items():
        for meta in field_info.metadata:
            if isinstance(meta, EmbeddingField):
                result.append(field_name)
                break
    return result


def _get_unique_fields(model_cls: type) -> list[str]:
    """
    Returns a list of field names annotated with UniqueField on the given model.

    Handles both direct Annotated metadata and list-wrapped annotations.
    """
    unique_fields: list[str] = []

    for field_name, field_info in model_cls.model_fields.items():
        for meta in field_info.metadata:
            if isinstance(meta, UniqueField):
                unique_fields.append(field_name)
                break

    return unique_fields


class BaseRepository(Generic[T]):
    """
    Generic Firestore repository with full CRUD and automatic ref-field hydration.

    Inject via the service constructor — do not instantiate in business logic.

    Usage:
        repo = BaseRepository(db=firestore_client, model_cls=Product)
        product = repo.get("product-123")  # currency auto-hydrated
    """

    def __init__(self, db: Client, model_cls: type[T]) -> None:
        self._db = db
        self._model_cls = model_cls
        self._collection = model_cls.collection_name  # type: ignore[attr-defined]
        self._embedding_fields = _get_embedding_fields(model_cls)

    def _to_firestore_data(self, data: dict) -> dict:
        """Converts list[float] embedding fields to Firestore Vector before writing."""
        if not self._embedding_fields:
            return data
        result = {**data}
        for field_name in self._embedding_fields:
            value = result.get(field_name)
            if isinstance(value, list):
                result[field_name] = Vector(value)
        return result

    def _from_firestore_data(self, data: dict) -> dict:
        """Converts Firestore Vector fields back to list[float] before passing to Pydantic."""
        if not self._embedding_fields:
            return data
        result = {**data}
        for field_name in self._embedding_fields:
            value = result.get(field_name)
            if isinstance(value, Vector):
                result[field_name] = list(value)
        return result

    def _resolve_scalar_ref(self, ref_key: str | None, target_cls: type) -> Any | None:
        """Fetches a single document by key and returns a model instance, or None."""
        if not ref_key:
            return None
        target_collection = target_cls.collection_name
        docs = self._db.collection(target_collection).where("key", "==", ref_key).limit(1).get()
        return target_cls(**docs[0].to_dict()) if docs else None

    def _resolve_list_ref(self, keys: list[str], target_cls: type) -> list[Any]:
        """Fetches a list of documents by key and returns model instances for those that exist."""
        result = []
        target_collection = target_cls.collection_name
        for key in keys:
            docs = self._db.collection(target_collection).where("key", "==", key).limit(1).get()
            if docs:
                result.append(target_cls(**docs[0].to_dict()))
        return result

    def _hydrate(self, instance: T, expand: set[str] | None = None) -> T:
        """
        Resolves RefField-annotated fields from stored keys to full model instances.

        Args:
            expand: Set of field names to hydrate. Pass None to skip all hydration
                    (fast path for list calls). Pass the special string "__all__" inside
                    the set to hydrate every ref field (default for get/get_by_key).

        Handles both scalar refs (str → Model) and list refs (list[str] → list[Model]).
        """
        ref_fields = _get_ref_fields(type(instance))
        if not ref_fields or expand is None:
            return instance

        # Resolve only the requested fields (or all if "__all__" is in the set)
        fields_to_resolve = (
            set(ref_fields.keys()) if "__all__" in expand
            else expand & set(ref_fields.keys())
        )
        if not fields_to_resolve:
            return instance

        # Start from a plain dict of the serialized values.
        data = instance.model_dump()  # type: ignore[attr-defined]

        # Overlay resolved objects — these will be set directly, skipping validation.
        resolved_overrides: dict[str, Any] = {}

        for field_name, (ref_field, is_list) in ref_fields.items():
            if field_name not in fields_to_resolve:
                continue
            target_cls = ref_field.model_cls
            if is_list:
                resolved_overrides[field_name] = self._resolve_list_ref(data.get(field_name) or [], target_cls)
            else:
                resolved = self._resolve_scalar_ref(data.get(field_name), target_cls)
                if resolved is not None:
                    resolved_overrides[field_name] = resolved

        # Re-instantiate embedded BaseModel list fields (e.g. list[Feature]) that model_dump()
        # serialized to plain dicts. model_construct skips validation so we do it manually here,
        # but only for fields that are NOT RefFields (those are handled above via resolved_overrides).
        merged = {**data, **resolved_overrides}
        for field_name, field_info in type(instance).model_fields.items():  # type: ignore[attr-defined]
            if field_name in resolved_overrides:
                continue  # Already resolved as a RefField — leave it alone.
            annotation = field_info.annotation
            if get_origin(annotation) is list:
                inner = get_args(annotation)
                if inner and isinstance(inner[0], type) and issubclass(inner[0], _BaseModel):
                    raw_list = merged.get(field_name) or []
                    merged[field_name] = [
                        inner[0](**item) if isinstance(item, dict) else item
                        for item in raw_list
                    ]

        return type(instance).model_construct(**merged)  # type: ignore[attr-defined]

    def get(self, id: str, expand: set[str] | None = None) -> T:
        """Fetches a document by ID. Defaults to full hydration (all ref fields resolved)."""
        doc = self._db.collection(self._collection).document(id).get()
        if not doc.exists:
            raise ValueError(f"{self._model_cls.__name__} '{id}' not found")
        instance = self._model_cls(**self._from_firestore_data(doc.to_dict()))
        return self._hydrate(instance, expand=expand if expand is not None else {"__all__"})

    def get_by_key(self, key: str, expand: set[str] | None = None) -> T | None:
        """Returns the item whose `key` matches. Defaults to full hydration."""
        docs = self._db.collection(self._collection).where("key", "==", key).limit(1).get()
        if not docs:
            return None
        instance = self._model_cls(**self._from_firestore_data(docs[0].to_dict()))
        return self._hydrate(instance, expand=expand if expand is not None else {"__all__"})

    def list(self, page: int = 1, limit: int = 10, filters: dict[str, Any] | None = None, expand: set[str] | None = None, sort_by: str = "created_at", order: str = "DESCENDING") -> list[T]:
        """Lists documents. No ref field hydration by default — pass expand={"products"} to resolve."""
        offset = (page - 1) * limit
        query = self._db.collection(self._collection)
        if filters:
            for k, v in filters.items():
                query = query.where(k, "==", v)

        # Normalise the order direction — guard against None being passed by callers.
        _order = (order or "DESCENDING").lower()
        direction = "ASCENDING" if _order in ("asc", "ascending") else "DESCENDING"
        _sort_by = sort_by or "created_at"

        docs = (
            query
            .order_by(_sort_by, direction=direction)
            .offset(offset)
            .limit(limit)
            .stream()
        )
        return [self._hydrate(self._model_cls(**self._from_firestore_data(doc.to_dict())), expand=expand) for doc in docs]

    def find_similar(
        self,
        query_vector: List[float],
        limit: int = 10,
        max_distance: float = 0.5,
        filters: Dict[str, Any] | None = None,
        exclude_id: str | None = None,
    ) -> List[Tuple[T, float]]:
        """
        Finds similar documents using Firestore's native KNN vector search (COSINE distance).

        When filters or exclude_id are supplied, extra candidates are fetched and
        filtered in Python — Firestore vector search does not support compound
        where() filters alongside find_nearest.

        Args:
            query_vector:  The embedding to compare against.
            limit:         Maximum results to return.
            max_distance:  Cosine distance ceiling (distance = 1 - similarity).
            filters:       Optional equality filters applied in Python after fetching.
            exclude_id:    Skip the document with this Firestore ID (e.g. self).

        Returns:
            List of (model_instance, cosine_distance) sorted by distance ascending.
        """
        needs_postfilter = bool(filters or exclude_id)
        fetch_limit = min(limit * 4 + 20, 1000) if needs_postfilter else limit

        vector_query = self._db.collection(self._collection).find_nearest(
            vector_field="embedding",
            query_vector=Vector(query_vector),
            distance_measure=DistanceMeasure.COSINE,
            limit=fetch_limit,
            distance_result_field="_distance",
            distance_threshold=max_distance,
        )

        result: list[tuple[T, float]] = []
        for doc in vector_query.stream():
            if len(result) >= limit:
                break
            if exclude_id and doc.id == exclude_id:
                continue
            data = self._from_firestore_data(doc.to_dict() or {})
            distance = data.pop("_distance", 0.0)
            if filters and any(data.get(k) != v for k, v in filters.items()):
                continue
            result.append((
                self._model_cls.model_construct(**{k: v for k, v in data.items() if k != "embedding"}),
                distance,
            ))

        return result

    def validate_unique(self, instance_or_dict: T | dict[str, Any], exclude_id: str | None = None) -> None:
        """
        Raises ValueError if any UniqueField value already exists in the collection.

        Pass exclude_id on update to skip the document being updated — otherwise
        a record would conflict with itself if the unique field hasn't changed.
        """
        unique_fields = _get_unique_fields(self._model_cls)
        if not unique_fields:
            return

        data = instance_or_dict if isinstance(instance_or_dict, dict) else instance_or_dict.model_dump()  # type: ignore[attr-defined]

        for field_name in unique_fields:
            value = data.get(field_name)
            if value is None:
                continue

            query = self._db.collection(self._collection).where(field_name, "==", value).limit(1)
            matches = query.get()

            for doc in matches:
                if exclude_id and doc.id == exclude_id:
                    continue
                raise ValueError(
                    f"Duplicate value for unique field '{field_name}': '{value}' "
                    f"already exists in '{self._collection}'."
                )

    def validate_refs(self, instance_or_dict: T | dict[str, Any]) -> None:
        """
        Validates that all RefField keys actually exist in Firestore.
        Throws ValueError if a referenced document is missing.
        """
        ref_fields = _get_ref_fields(self._model_cls)
        if not ref_fields:
            return

        data = instance_or_dict if isinstance(instance_or_dict, dict) else instance_or_dict.model_dump()

        for field_name, (ref_field, is_list) in ref_fields.items():
            value = data.get(field_name)
            if not value:
                continue

            target_cls = ref_field.model_cls
            target_collection = target_cls.collection_name

            raw_items = value if is_list else [value]

            # Extract keys from model instances or raw strings
            keys_to_check: list[str] = []
            for item in raw_items:
                if isinstance(item, str):
                    keys_to_check.append(item)
                elif hasattr(item, "key") and item.key:
                    keys_to_check.append(str(item.key))
                elif isinstance(item, dict) and item.get("key"):
                    keys_to_check.append(str(item["key"]))

            for ref_key in keys_to_check:
                docs = self._db.collection(target_collection).where("key", "==", ref_key).limit(1).get()
                if not docs:
                    raise ValueError(f"Invalid reference for field '{field_name}': {target_cls.__name__} with key '{ref_key}' does not exist.")

    def create(self, instance: T) -> T:
        self.validate_unique(instance)
        self.validate_refs(instance)

        if not instance.id:
            instance.id = self._db.collection(self._collection).document().id

        # If no key provided, generate a slugified key from name + 4 char unique suffix
        if not instance.key:
            name_val = getattr(instance, "name", "doc")
            suffix = str(uuid.uuid4())[:4]
            instance.key = f"{slugify(str(name_val))}-{suffix}"

        data = self._to_firestore_data(instance.model_dump())  # type: ignore[attr-defined]
        self._db.collection(self._collection).document(instance.id).set(data)
        return instance

    def update(self, id: str, data: dict[str, Any]) -> T:
        self.validate_unique(data, exclude_id=id)
        self.validate_refs(data)
        self._db.collection(self._collection).document(id).update(self._to_firestore_data(data))
        return self.get(id)

    def delete(self, id: str) -> None:
        self._db.collection(self._collection).document(id).delete()
