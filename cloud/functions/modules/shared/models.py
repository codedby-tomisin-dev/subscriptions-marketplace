from datetime import datetime, timezone
from enum import Enum
from typing import ClassVar

from pydantic import BaseModel, Field


class Status(str, Enum):
    ACTIVE = "active"      # Live / enrichment complete.
    INACTIVE = "inactive"
    # Enrichment lifecycle states
    PENDING = "pending"    # Newly created — agent has not run yet.
    FAILED = "failed"      # Agent encountered an error.


class Base(BaseModel):
    # Subclasses must declare this — used by BaseRepository for Firestore lookups.
    collection_name: ClassVar[str]

    id: str | None = None
    key: str | None = None
    metadata: dict | None = None
    created_at: str | None = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str | None = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: Status = Status.ACTIVE
