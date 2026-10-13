from firebase_functions import https_fn

from core.firestore import get_db
from modules.shared.handler_context import traced_call
from modules.team.claims import FirebaseAdminClaims
from modules.team.repository import TeamRepository
from modules.team.service import TeamService


def build_team_service() -> TeamService:
    return TeamService(TeamRepository(get_db()), FirebaseAdminClaims())


@https_fn.on_call()
@traced_call
def join_admin_team(req: https_fn.CallableRequest) -> dict:
    """Signed-in user → admin, if there are no admins yet or their email was invited."""
    token = req.auth.token
    result = build_team_service().join(
        uid=req.auth.uid,
        email=token.get("email"),
        email_verified=bool(token.get("email_verified")),
        name=token.get("name"),
    )
    return {"result": result}


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_invite_member(req: https_fn.CallableRequest) -> dict:
    """{email} → that email can join the team after signing in."""
    invite = build_team_service().invite(email=(req.data or {}).get("email"), actor_uid=req.auth.uid, actor_email=req.auth.token.get("email"))
    return {"email": invite.id}


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_cancel_invite(req: https_fn.CallableRequest) -> dict:
    build_team_service().cancel_invite((req.data or {}).get("email"))
    return {"ok": True}


@https_fn.on_call()
@traced_call(require_admin=True)
def admin_remove_member(req: https_fn.CallableRequest) -> dict:
    """{uid} → off the team and signed out. Not yourself, and never the last admin."""
    build_team_service().remove_member(uid=str((req.data or {}).get("uid") or ""), actor_uid=req.auth.uid)
    return {"ok": True}
