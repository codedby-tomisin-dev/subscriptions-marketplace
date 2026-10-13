from datetime import date

from modules.analytics.metrics import reorder_quantity
from modules.analytics.service import AnalyticsService
from modules.inventory.models import Reorder
from modules.inventory.repository import InventoryRepository
from modules.shared.clock import timestamp
from modules.shared.errors import FailedPrecondition


class InventoryService:
    def __init__(self, inventory: InventoryRepository, analytics: AnalyticsService) -> None:
        self._inventory = inventory
        self._analytics = analytics

    def draft_reorder(self, item_id: str, actor: str, today: date) -> Reorder:
        """Records a draft supplier order for two rounds' worth. There's no supplier API; ops places it."""
        rows = [row for box in self._analytics.stock(today)["boxes"] for row in box["items"] if row["itemId"] == item_id]
        if not rows:
            raise KeyError(f"No stock item {item_id}")
        row = rows[0]
        if row["needed"] == 0:
            raise FailedPrecondition(f"Nothing in the next round needs {row['name']}.")
        reorder = Reorder(
            item_id=item_id,
            box_id=row["boxId"],
            item_name=row["name"],
            quantity=reorder_quantity(row["stock"], row["needed"]),
            created_by=actor,
            created_at=timestamp(),
        )
        return reorder.model_copy(update={"id": self._inventory.add_reorder(reorder)})
