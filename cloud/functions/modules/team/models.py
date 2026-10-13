from modules.shared.document import Document


class TeamMember(Document):
    """`admins/{uid}`. The `role: admin` custom claim is what grants access; this doc lists the team."""

    id: str
    email: str
    name: str | None = None
    # The uid of the admin who invited them; None for the first admin.
    invited_by: str | None = None
    joined_at: str


class Invite(Document):
    """`admin_invites/{email}`: lets that email join the team once they've signed in with it."""

    id: str
    invited_by: str
    invited_by_email: str | None = None
    created_at: str
