import { collection, onSnapshot } from "firebase/firestore";
import { callFunction, firestore } from "@/shared/api";

/** `admins/{uid}` */
export interface TeamMember {
  id: string;
  email: string;
  name: string | null;
  invitedBy: string | null;
  joinedAt: string;
}

/** `admin_invites/{email}` */
export interface Invite {
  id: string;
  invitedBy: string;
  invitedByEmail: string | null;
  createdAt: string;
}

function watchCollection<T>(name: string, onChange: (items: T[]) => void) {
  return onSnapshot(
    collection(firestore(), name),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T)),
    () => onChange([]),
  );
}

export const watchTeam = (onChange: (members: TeamMember[]) => void) => watchCollection("admins", onChange);
export const watchInvites = (onChange: (invites: Invite[]) => void) => watchCollection("admin_invites", onChange);

export const inviteMember = (email: string) => callFunction<{ email: string }, { email: string }>("admin_invite_member", { email });
export const cancelInvite = (email: string) => callFunction<{ email: string }, { ok: boolean }>("admin_cancel_invite", { email });
export const removeMember = (uid: string) => callFunction<{ uid: string }, { ok: boolean }>("admin_remove_member", { uid });
