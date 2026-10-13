from modules.shared.document import Document


class InventoryItem(Document):
    """`inventory/{itemId}`; ids match the catalog's InventoryItem ids."""

    id: str
    box_id: str
    name: str
    stock: int
    in_weekly_box: bool = True


class Reorder(Document):
    """`reorders/{id}`: a drafted supplier order. Recording it is all we do; no supplier API."""

    id: str | None = None
    item_id: str
    box_id: str
    item_name: str
    quantity: int
    status: str = "draft"
    created_by: str
    created_at: str
