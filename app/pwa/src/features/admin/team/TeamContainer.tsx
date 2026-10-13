"use client";

import { useState, type FormEvent } from "react";
import { Mail, UserPlus } from "lucide-react";
import { Button, Dialog, Input } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { formatShortDate } from "@/shared/utils";
import { AdminPageHeader, AdminPanel, adminStyles as admin } from "../shared";
import type { TeamMember } from "./api";
import { useTeam } from "./useTeam";
import styles from "./Team.module.css";

export function TeamContainer() {
  const team = useTeam();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const emailOf = (uid: string | null) => team.members.find((member) => member.id === uid)?.email;

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault();
    if (await team.invite(email)) setEmail("");
  };

  return (
    <>
      <AdminPageHeader title="Team" subtitle="Who can use Bonbon Ops. It’s invite-only: invite an email, and they sign in at /admin with it." />

      <AdminPanel title="Invite someone" className={styles.invitePanel}>
        <form onSubmit={submitInvite} className={styles.inviteForm}>
          <div className={styles.inviteInput}>
            <Input type="email" ariaLabel="Email to invite" iconLeft={Mail} placeholder="name@example.com" value={email} onChange={setEmail} required />
          </div>
          <Button type="submit" iconLeft={UserPlus} loading={team.busyId === "invite"}>
            Invite
          </Button>
        </form>
      </AdminPanel>

      <AdminPanel title="Members" flush className={styles.section}>
        <div className={admin.tableWrap}>
          <table className={admin.table}>
            <thead>
              <tr>
                <th>Person</th>
                <th>Joined</th>
                <th>Invited by</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {team.members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <div className={styles.person}>
                      <span className={admin.strong}>{member.name ?? member.email}</span>
                      {member.name && <span className={admin.subtle}>{member.email}</span>}
                    </div>
                  </td>
                  <td>{formatShortDate(member.joinedAt.slice(0, 10))}</td>
                  <td>{member.invitedBy ? (emailOf(member.invitedBy) ?? "A former admin") : <span className={admin.subtle}>First admin</span>}</td>
                  <td className={admin.right}>
                    {member.id === user?.uid ? (
                      <span className={admin.subtle}>You</span>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setRemoving(member)} loading={team.busyId === member.id} style={{ color: "var(--danger-fg)" }}>
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      <AdminPanel title="Pending invites" flush className={styles.section}>
        <div className={admin.tableWrap}>
          <table className={admin.table}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Invited</th>
                <th>By</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {team.invites.map((invite) => (
                <tr key={invite.id}>
                  <td className={admin.strong}>{invite.id}</td>
                  <td>{formatShortDate(invite.createdAt.slice(0, 10))}</td>
                  <td>{invite.invitedByEmail ?? emailOf(invite.invitedBy) ?? "—"}</td>
                  <td className={admin.right}>
                    <Button size="sm" variant="ghost" onClick={() => team.cancel(invite.id)} loading={team.busyId === invite.id}>
                      Cancel invite
                    </Button>
                  </td>
                </tr>
              ))}
              {!team.invites.length && (
                <tr>
                  <td colSpan={4} className={admin.emptyRow}>
                    No pending invites.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPanel>

      {removing && (
        <Dialog
          open
          onClose={() => setRemoving(null)}
          title={`Remove ${removing.name ?? removing.email}?`}
          description="They lose access to Bonbon Ops straight away and are signed out. You can invite them again later."
          footer={
            <>
              <Button variant="ghost" onClick={() => setRemoving(null)}>
                Keep them
              </Button>
              <Button
                onClick={() => {
                  team.remove(removing);
                  setRemoving(null);
                }}
              >
                Remove
              </Button>
            </>
          }
        />
      )}
    </>
  );
}
