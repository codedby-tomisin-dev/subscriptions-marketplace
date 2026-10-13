"""Adds a user to the admin team (role claim + `admins/{uid}`), creating the user in the emulator if needed.

    venv/bin/python scripts/grant_admin.py ops@example.com          # emulators
    venv/bin/python scripts/grant_admin.py ops@example.com --live --project my-project

Normally you don't need this: on a fresh project the first person to sign in at
/admin becomes an admin, and they invite everyone else. This skips the invite.
The user must sign out and in again (or refresh their ID token) to pick up the claim.
"""
import argparse
import sys
from pathlib import Path

from firebase_admin import auth, firestore

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from _connect import add_connection_args, connect  # noqa: E402
from modules.team.claims import FirebaseAdminClaims  # noqa: E402
from modules.team.repository import TeamRepository  # noqa: E402


def grant_admin_role(email: str, create_if_missing: bool) -> str:
    try:
        user = auth.get_user_by_email(email)
    except auth.UserNotFoundError:
        if not create_if_missing:
            raise SystemExit(f"No user with email {email}. Sign in once first.")
        user = auth.create_user(email=email, email_verified=True)
    TeamRepository(firestore.client()).join(uid=user.uid, email=email.lower(), name=user.display_name, may_use_invite=True, force=True)
    FirebaseAdminClaims().grant(user.uid)
    return user.uid


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("email")
    add_connection_args(parser)
    args = parser.parse_args()
    connect(args)
    uid = grant_admin_role(args.email, create_if_missing=not args.live)
    print(f"{args.email} ({uid}) is now an admin.")


if __name__ == "__main__":
    main()
