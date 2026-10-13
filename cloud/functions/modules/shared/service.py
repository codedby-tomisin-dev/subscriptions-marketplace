from typing import Generic, TypeVar, Any

from modules.shared.repository import BaseRepository

T = TypeVar("T")


class BaseService(Generic[T]):
    """
    Base class for all domain services.

    Services receive a repository via constructor injection and delegate
    all persistence to it. Business logic lives in service methods;
    data access lives in the repository.

    Usage:
        repo = BaseRepository(db=firestore_client, model_cls=Product)
        service = ProductService(repo=repo)
    """

    def __init__(self, repo: BaseRepository[T]) -> None:
        self._repo = repo

    def get(self, id: str) -> T:
        return self._repo.get(id)

    def list(self, page: int = 1, limit: int = 10, filters: dict[str, Any] | None = None, expand: set[str] | None = None, sort_by: str = "created_at", order: str = "DESCENDING") -> list[T]:
        return self._repo.list(page=page, limit=limit, filters=filters, expand=expand, sort_by=sort_by, order=order)

    def create(self, instance: T) -> T:
        return self._repo.create(instance)

    def update(self, id: str, data: dict[str, Any]) -> T:
        return self._repo.update(id, data)

    def delete(self, id: str) -> None:
        self._repo.delete(id)
