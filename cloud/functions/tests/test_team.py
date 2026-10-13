import pytest

from modules.shared.errors import FailedPrecondition
from modules.team.repository import TeamRepository
from modules.team.service import TeamService, normalise_email


class FakeClaims:
    def __init__(self) -> None:
        self.admins: set[str] = set()

    def grant(self, uid: str) -> None:
        self.admins.add(uid)

    def revoke(self, uid: str) -> None:
        self.admins.discard(uid)


@pytest.fixture
def team(db):
    claims = FakeClaims()
    return TeamService(TeamRepository(db), claims), claims


def join(service: TeamService, uid: str, email: str, verified: bool = True):
    return service.join(uid=uid, email=email, email_verified=verified, name=None)


def test_first_person_in_becomes_admin_then_it_is_invite_only(team):
    service, claims = team
    assert join(service, "ruth", "ruth@bonbon.test") == "first_admin"
    assert claims.admins == {"ruth"}
    with pytest.raises(PermissionError):
        join(service, "mallory", "mallory@example.com")
    assert claims.admins == {"ruth"}


def test_invited_email_can_join_once_verified(team):
    service, claims = team
    join(service, "ruth", "ruth@bonbon.test")
    service.invite(email="  Sam@Bonbon.test ", actor_uid="ruth", actor_email="ruth@bonbon.test")

    with pytest.raises(PermissionError):
        join(service, "sam", "sam@bonbon.test", verified=False)
    assert join(service, "sam", "SAM@bonbon.test") == "invited"
    assert claims.admins == {"ruth", "sam"}
    # The invite is used up.
    with pytest.raises(PermissionError):
        join(service, "sam2", "sam@bonbon.test")


def test_joining_again_is_harmless_and_restores_a_missing_claim(team):
    service, claims = team
    join(service, "ruth", "ruth@bonbon.test")
    claims.admins.clear()
    assert join(service, "ruth", "ruth@bonbon.test") == "already_member"
    assert claims.admins == {"ruth"}


def test_cant_invite_an_existing_member(team):
    service, _ = team
    join(service, "ruth", "ruth@bonbon.test")
    with pytest.raises(FailedPrecondition):
        service.invite(email="ruth@bonbon.test", actor_uid="ruth", actor_email=None)


def test_removing_members(team):
    service, claims = team
    join(service, "ruth", "ruth@bonbon.test")
    with pytest.raises(FailedPrecondition):
        service.remove_member(uid="ruth", actor_uid="ruth")
    service.invite(email="sam@bonbon.test", actor_uid="ruth", actor_email=None)
    join(service, "sam", "sam@bonbon.test")

    service.remove_member(uid="sam", actor_uid="ruth")
    assert claims.admins == {"ruth"}
    # Ruth is now the only admin, so nobody (even another admin's request) can remove her.
    with pytest.raises(PermissionError):
        service.remove_member(uid="ruth", actor_uid="sam")


def test_cancelled_invites_stop_working(team):
    service, _ = team
    join(service, "ruth", "ruth@bonbon.test")
    service.invite(email="sam@bonbon.test", actor_uid="ruth", actor_email=None)
    service.cancel_invite("sam@bonbon.test")
    with pytest.raises(PermissionError):
        join(service, "sam", "sam@bonbon.test")


@pytest.mark.parametrize("bad", ["", "nope", "a@b", "a/b@c.com", None])
def test_rejects_bad_emails(bad):
    with pytest.raises(ValueError):
        normalise_email(bad)
