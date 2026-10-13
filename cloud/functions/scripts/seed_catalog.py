"""Loads the five starter boxes into `boxes/` (and their inventory items). Skips boxes that exist.

    venv/bin/python scripts/seed_catalog.py                                   # emulators
    venv/bin/python scripts/seed_catalog.py --live                            # the real project, once

After that, boxes are edited in the admin (Boxes & stock → Edit / New box).
"""
import argparse
import sys
from pathlib import Path

from firebase_admin import firestore

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from _connect import add_connection_args, connect  # noqa: E402
from modules.catalog.catalog import starter_boxes  # noqa: E402
from modules.catalog.repository import CatalogRepository  # noqa: E402
from modules.inventory.repository import InventoryRepository  # noqa: E402
from modules.shared.clock import timestamp  # noqa: E402


def seed_catalog(db, overwrite: bool = False) -> list[str]:
    repo, inventory = CatalogRepository(db), InventoryRepository(db)
    added = []
    for box in starter_boxes():
        if repo.exists(box.id) and not overwrite:
            continue
        now = timestamp()
        box = box.model_copy(update={"created_at": now, "updated_at": now})
        repo.save(box)
        inventory.ensure_items(box)
        added.append(box.id)
    return added


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--overwrite", action="store_true", help="Replace starter boxes that already exist")
    add_connection_args(parser)
    args = parser.parse_args()
    connect(args)
    added = seed_catalog(firestore.client(), overwrite=args.overwrite)
    print(f"Added {', '.join(added)}." if added else "Every starter box is already there.")


if __name__ == "__main__":
    main()
