import re

from core import telemetry
from modules.shared.clock import timestamp
from modules.shared.errors import FailedPrecondition
from modules.team.claims import AdminClaims
from modules.team.models import Invite
from modules.team.repository import JoinResult, TeamRepository

# Deliberately loose: the real check is that they can open a sign-in link sent to it.
# No "/" because the email is the invite's document id.
_EMAIL = re.compile(r"^[^@\s/]+@[^@\s/]+\.[^@\s/]+$")


def normalise_email(email: object) -> str:
    value = str(email or "").strip().lower()
    if not _EMAIL.match(value):
        raise ValueError("That doesn’t look like an email address.")
    return value


class TeamService:
    """Who can use the admin portal: open to the first person while there are no admins, invite-only after."""

    def __init__(self, repo: TeamRepository, claims: AdminClaims) -> None:
        self._repo = repo
        self._claims = claims

    def join(self, *, uid: str, email: str | None, email_verified: bool, name: str | None) -> JoinResult:
        if not email:
            raise PermissionError("Sign in with an email address to use the admin portal.")
        # Invites only count for a proven email (sign-in links verify it).
        result = self._repo.join(uid=uid, email=normalise_email(email), name=name, may_use_invite=email_verified)
        # Also for "already_member": re-grants the claim if an earlier attempt failed after the write.
        self._claims.grant(uid)
        telemetry.event("admin_joined", result=result)
        return result

    def invite(self, *, email: object, actor_uid: str, actor_email: str | None) -> Invite:
        address = normalise_email(email)
        if self._repo.find_member_by_email(address):
            raise FailedPrecondition(f"{address} is already on the team.")
        invite = Invite(id=address, invited_by=actor_uid, invited_by_email=actor_email, created_at=timestamp())
        self._repo.save_invite(invite)
        return invite

    def cancel_invite(self, email: object) -> None:
        self._repo.delete_invite(normalise_email(email))

    def remove_member(self, *, uid: str, actor_uid: str) -> None:
        if uid == actor_uid:
            raise FailedPrecondition("You can’t remove yourself. Ask another admin.")
        self._repo.remove(uid)
        self._claims.revoke(uid)
