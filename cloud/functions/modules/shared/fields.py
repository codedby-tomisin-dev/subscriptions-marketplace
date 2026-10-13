from typing import Any

from pydantic import GetCoreSchemaHandler
from pydantic_core import core_schema


class RefField:
    """
    Pydantic field metadata for foreign-key-style references.

    Accepts a Base model instance (extracts .key) or a raw str Key.
    Always stores and serializes as str. Hydration back to the full
    object is handled automatically by BaseRepository._hydrate().

    Usage:
        currency: Annotated[str, RefField(Currency)]
    """

    def __init__(self, model_cls: type) -> None:
        self.model_cls = model_cls

    def __get_pydantic_core_schema__(
        self, source_type: Any, handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        return core_schema.with_info_plain_validator_function(
            self._validate,
            serialization=core_schema.plain_serializer_function_ser_schema(
                self._serialize,
                return_schema=core_schema.any_schema(),
            ),
        )

    def _serialize(self, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, self.model_cls):
            return value.model_dump()
        if hasattr(value, "key") and value.key:
            return str(value.key)
        return str(value)

    def _validate(self, value: Any, info: core_schema.ValidationInfo) -> Any:
        if value is None:
            return None
        # Keep full model instances intact so they can be serialised as dicts later
        if isinstance(value, self.model_cls):
            return value

        if isinstance(value, str):
            return value

        if hasattr(value, "key") and value.key:
            return str(value.key)

        raise ValueError(
            f"Expected str key or {self.model_cls.__name__} instance, "
            f"got {type(value).__name__}"
        )


class UniqueField:
    """
    Marks a field as unique within its Firestore collection.

    Enforcement is handled by BaseRepository.validate_unique() on every
    create and update. Use inside Annotated on any str field in a Base model.

    Usage:
        name: Annotated[str, UniqueField()]
    """
    pass


class EmbeddingField:
    """
    Marks a list[float] field as a Firestore Vector embedding.

    BaseRepository uses this marker to automatically convert list[float] → Vector
    before writing to Firestore (enabling find_nearest KNN search), and Vector →
    list[float] when reading back so Pydantic validation is unaffected.

    Usage:
        embedding: Annotated[list[float] | None, EmbeddingField()] = None
    """
    pass
