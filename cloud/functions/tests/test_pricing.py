import re
from pathlib import Path

import pytest

from modules.catalog import pricing
from modules.catalog.pricing import profit_pence, suggested_price_pence

PRICING_TS = Path(__file__).resolve().parents[3] / "app/pwa/src/features/admin/boxes/pricing.ts"


@pytest.mark.parametrize(
    "goods, price",
    [
        (0, 500),  # just delivery and packaging, rounded up
        (1000, 1800),  # £13 + £4.75 = £17.75 → £18
        (550, 1200),  # £7.15 + £4.75 = £11.90 → £12
        (2000, 3100),  # £26 + £4.75 = £30.75 → £31
    ],
)
def test_price_is_goods_plus_30_percent_plus_delivery_and_packaging(goods, price):
    assert suggested_price_pence(goods) == price


def test_profit_takes_off_goods_delivery_and_packaging():
    assert profit_pence(1800, 1000) == 325


def test_the_admin_editor_uses_the_same_numbers():
    source = PRICING_TS.read_text()
    for name in ("SERVICE_MARKUP_PERCENT", "DELIVERY_PENCE", "PACKAGING_PENCE", "ROUND_UP_TO_PENCE"):
        match = re.search(rf"export const {name} = (\d+);", source)
        assert match and int(match.group(1)) == getattr(pricing, name), name
