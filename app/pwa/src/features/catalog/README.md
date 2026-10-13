# Catalog

The boxes on sale: copy, prices, photos and packing recipes.

- **Source of truth:** Firestore `boxes/{id}`. Admins edit it from Boxes & stock → New box / Edit, through the `admin_save_box` function (cloud/functions/modules/catalog). Nobody writes it from the browser. A fresh project is seeded with `scripts/seed_catalog.py`.
- **Reading it:** storefront pages fetch it on the server (`fetchActiveBoxes`, `fetchBox`) and revalidate every minute. Client components use `useCatalog()`, a live listener that includes archived boxes, since old subscriptions and orders still point at them.
- **Prices** are what new subscribers pay. Saving a new price makes a new Stripe price; existing subscriptions keep `subscription.pricePence`.
- **Icons** for a box's facts are stored by name; `BOX_ICONS` is the allowed set.
