from datetime import date

from modules.fulfilment.orders import can_move, order_number, ship_date_for


def test_order_numbers_continue_the_sequence():
    assert order_number(0) == "BB-20450"
    assert order_number(12) == "BB-20462"


def test_ships_the_working_day_before_delivery():
    assert ship_date_for(date(2026, 10, 15)) == date(2026, 10, 14)
    assert ship_date_for(date(2026, 10, 19)) == date(2026, 10, 16)  # Monday → Friday


def test_orders_only_move_forward():
    assert can_move("topack", "packed")
    assert can_move("topack", "shipped")
    assert not can_move("shipped", "packed")
    assert not can_move("delivered", "delivered")


def test_orders_can_be_refunded_once():
    assert can_move("shipped", "refunded")
    assert not can_move("refunded", "refunded")
    assert not can_move("refunded", "packed")
