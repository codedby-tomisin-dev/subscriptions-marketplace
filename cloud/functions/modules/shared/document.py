from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class Document(BaseModel):
    """A Firestore document. Fields are snake_case in Python and camelCase in Firestore,
    where the web app reads them directly."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)

    def to_firestore(self) -> dict:
        return self.model_dump(by_alias=True, exclude={"id"})
