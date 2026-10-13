from firebase_functions import https_fn

from modules.billing.wiring import build_subscription_service
from modules.shared.clock import today_in_london
from modules.shared.handler_context import is_admin, traced_call


@https_fn.on_call()
@traced_call
def manage_subscription(req: https_fn.CallableRequest) -> dict:
    """One change to one subscription: {subscriptionId, action, ...params}.

    Customers may change their own subscriptions; admins may change anyone's.
    Actions: change_cadence {cadence, retention?}, skip_next, unskip, pause {retention?},
    resume, cancel {reason?}, undo_cancel, restart.
    """
    data = req.data or {}
    subscription = build_subscription_service().manage(
        subscription_id=str(data.get("subscriptionId") or ""),
        action=str(data.get("action") or ""),
        params=data,
        actor=req.auth.uid,
        is_admin=is_admin(req.auth),
        today=today_in_london(),
    )
    return {"subscription": {"id": subscription.id, **subscription.to_firestore()}}
