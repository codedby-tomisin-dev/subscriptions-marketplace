from typing import Protocol

from firebase_admin import auth

from modules.shared.handler_context import ADMIN_ROLE


class AdminClaims(Protocol):
    def grant(self, uid: str) -> None: ...

    def revoke(self, uid: str) -> None: ...


class FirebaseAdminClaims:
    """Sets the `role` custom claim that Firestore rules and admin functions check."""

    def grant(self, uid: str) -> None:
        user = auth.get_user(uid)
        auth.set_custom_user_claims(uid, {**(user.custom_claims or {}), "role": ADMIN_ROLE})

    def revoke(self, uid: str) -> None:
        user = auth.get_user(uid)
        claims = {key: value for key, value in (user.custom_claims or {}).items() if key != "role"}
        auth.set_custom_user_claims(uid, claims or None)
        # Signs them out everywhere, so the old token (with the claim) stops working within the hour.
        auth.revoke_refresh_tokens(uid)
