import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/components/ui";
import { describeError } from "@/shared/api";
import { cancelInvite, inviteMember, removeMember, watchInvites, watchTeam, type Invite, type TeamMember } from "./api";

/** The admin team and pending invites, live, plus the calls that change them. */
export function useTeam() {
  const { showToast } = useToast();
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const stops = [watchTeam(setMembers), watchInvites(setInvites)];
    return () => stops.forEach((stop) => stop());
  }, []);

  const run = useCallback(
    async (id: string, task: () => Promise<unknown>, success: { title: string; message?: string }) => {
      setBusyId(id);
      try {
        await task();
        showToast({ tone: "success", ...success });
        return true;
      } catch (error) {
        showToast({ tone: "danger", title: "That didn’t go through", message: describeError(error) });
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [showToast],
  );

  return {
    isLoading: members === null,
    members: [...(members ?? [])].sort((a, b) => a.joinedAt.localeCompare(b.joinedAt)),
    invites: [...invites].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    busyId,
    invite: (email: string) =>
      run("invite", () => inviteMember(email), {
        title: "Invite saved",
        message: `${email.trim()} can now sign in at /admin with that email.`,
      }),
    cancel: (email: string) => run(email, () => cancelInvite(email), { title: "Invite cancelled" }),
    remove: (member: TeamMember) =>
      run(member.id, () => removeMember(member.id), { title: `${member.name ?? member.email} removed`, message: "They’ve been signed out." }),
  };
}
