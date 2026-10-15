"""How a box is priced: what its goods cost in the shops, plus 30% for the experience
(our service), plus delivery and packaging. Prices round up to the next 50p.

Mirrored for the admin's profit table in app/pwa/src/features/admin/boxes/pricing.ts;
tests/test_pricing.py keeps the two in step.
"""
SERVICE_MARKUP_PERCENT = 30
DELIVERY_PENCE = 375
PACKAGING_PENCE = 100
ROUND_UP_TO_PENCE = 50


def suggested_price_pence(goods_pence: int) -> int:
    """Goods (the items' average supermarket prices, summed) → the box's price, in pence."""
    # In hundredths of a penny, so the 30% stays exact.
    exact = goods_pence * (100 + SERVICE_MARKUP_PERCENT) + (DELIVERY_PENCE + PACKAGING_PENCE) * 100
    step = ROUND_UP_TO_PENCE * 100
    return -(-exact // step) * ROUND_UP_TO_PENCE


def profit_pence(price_pence: int, goods_pence: int) -> int:
    """What's left of a box's price after its goods, delivery and packaging."""
    return price_pence - goods_pence - DELIVERY_PENCE - PACKAGING_PENCE
