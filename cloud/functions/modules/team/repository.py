from typing import Literal

from google.cloud import firestore
from google.cloud.firestore import Client
from google.cloud.firestore_v1.base_query import FieldFilter

from modules.shared.clock import timestamp
from modules.team.models import Invite, TeamMember

MEMBERS = "admins"
INVITES = "admin_invites"
# Functions-only count of admins; the "is this the first admin?" check reads it in a transaction.
COUNTER = ("counters", "admins")

JoinResult = Literal["first_admin", "invited", "already_member"]


class TeamRepository:
    def __init__(self, db: Client) -> None:
        self._db = db

    def _counter(self):
        return self._db.collection(COUNTER[0]).document(COUNTER[1])

    def find_member_by_email(self, email: str) -> TeamMember | None:
        query = self._db.collection(MEMBERS).where(filter=FieldFilter("email", "==", email)).limit(1)
        return next((TeamMember(id=doc.id, **doc.to_dict()) for doc in query.stream()), None)

    def get_member(self, uid: str) -> TeamMember:
        snapshot = self._db.collection(MEMBERS).document(uid).get()
        if not snapshot.exists:
            raise KeyError("No such team member")
        return TeamMember(id=snapshot.id, **snapshot.to_dict())

    def join(self, *, uid: str, email: str, name: str | None, may_use_invite: bool, force: bool = False) -> JoinResult:
        """Adds `uid` to the team if there are no admins yet, or if `email` has an invite.

        One transaction, so two people can't both become the first admin. Raises
        PermissionError otherwise. `force` (dev scripts only) skips the checks.
        """
        db = self._db
        member_ref = db.collection(MEMBERS).document(uid)
        invite_ref = db.collection(INVITES).document(email)

        @firestore.transactional
        def write(transaction: firestore.Transaction) -> JoinResult:
            counter = self._counter().get(transaction=transaction)
            member = member_ref.get(transaction=transaction)
            invite = invite_ref.get(transaction=transaction)
            if member.exists:
                return "already_member"

            count = counter.get("count") if counter.exists else 0
            if count == 0 or force:
                result: JoinResult = "first_admin" if count == 0 else "invited"
            elif invite.exists and may_use_invite:
                result = "invited"
            else:
                raise PermissionError("The admin portal is invite-only. Ask someone on the team to invite this email.")

            joined = TeamMember(
                id=uid,
                email=email,
                name=name,
                invited_by=invite.get("invitedBy") if invite.exists else None,
                joined_at=timestamp(),
            )
            transaction.set(self._counter(), {"count": count + 1})
            transaction.set(member_ref, joined.to_firestore())
            if invite.exists:
                transaction.delete(invite_ref)
            return result

        return write(db.transaction())

    def remove(self, uid: str) -> None:
        """Takes `uid` off the team. Refuses to remove the last admin."""
        member_ref = self._db.collection(MEMBERS).document(uid)

        @firestore.transactional
        def write(transaction: firestore.Transaction) -> None:
            counter = self._counter().get(transaction=transaction)
            member = member_ref.get(transaction=transaction)
            if not member.exists:
                raise KeyError("No such team member")
            count = counter.get("count") if counter.exists else 0
            if count <= 1:
                raise PermissionError("You can’t remove the last admin.")
            transaction.set(self._counter(), {"count": count - 1})
            transaction.delete(member_ref)

        write(self._db.transaction())

    def save_invite(self, invite: Invite) -> None:
        self._db.collection(INVITES).document(invite.id).set(invite.to_firestore())

    def delete_invite(self, email: str) -> None:
        self._db.collection(INVITES).document(email).delete()
