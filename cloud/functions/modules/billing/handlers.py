from datetime import date

from firebase_functions import https_fn

from core import config
from modules.billing.wiring import build_billing_service, stripe_gateway
from modules.catalog.catalog import parse_purchase_option
from modules.shared.clock import today_in_london
from modules.shared.handler_context import traced_call, traced_request
from modules.shared.responses import make_success_response


@https_fn.on_call()
@traced_call
def create_checkout_session(req: https_fn.CallableRequest) -> dict:
    """{boxId, cadence: week|month|once, firstDelivery, isGift} → {url} of a Stripe Checkout page.
    "once" buys a single box, delivered on `firstDelivery`, with no subscription."""
    data = req.data or {}
    email = req.auth.token.get("email")
    if not email:
        raise ValueError("Your account needs an email address to check out.")
    try:
        first_delivery = date.fromisoformat(str(data.get("firstDelivery")))
    except ValueError:
        raise ValueError("Pick one of the delivery dates shown.") from None
    url = build_billing_service().start_checkout(
        uid=req.auth.uid,
        email=email,
        box_id=str(data.get("boxId") or ""),
        option=parse_purchase_option(data.get("cadence")),
        first_delivery=first_delivery,
        is_gift=bool(data.get("isGift")),
        today=today_in_london(),
        app_url=config.APP_BASE_URL.value.rstrip("/"),
    )
    return {"url": url}


@https_fn.on_request()
@traced_request
def stripe_webhook(req: https_fn.Request) -> https_fn.Response:
    """Stripe → us. Signature-verified; safe to receive the same event twice."""
    event = stripe_gateway().parse_webhook(req.get_data(), req.headers.get("Stripe-Signature"))
    build_billing_service().handle_event(event, today_in_london())
    return make_success_response({"received": True})


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_refund_order(req: https_fn.CallableRequest) -> dict:
    """{orderId} → refunds the order's charge in Stripe and marks it refunded."""
    order = build_billing_service().refund_order(order_id=str((req.data or {}).get("orderId") or ""), actor=req.auth.uid)
    return {"orderId": order.id, "status": order.status}
