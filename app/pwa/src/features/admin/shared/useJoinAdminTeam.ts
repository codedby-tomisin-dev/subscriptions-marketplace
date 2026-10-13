import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { callFunction, describeError } from "@/shared/api";

type JoinState = { status: "idle" | "joining" } | { status: "refused"; message: string };

/**
 * A signed-in person without the admin role tries to join the team once:
 * that works while there are no admins yet (a fresh project) or with an invite.
 * On success the token is refreshed and the role appears.
 */
export function useJoinAdminTeam(user: User | null, isAdmin: boolean, refreshClaims: () => Promise<void>) {
  const [state, setState] = useState<{ uid: string; join: JoinState } | null>(null);
  const uid = user?.uid ?? null;

  useEffect(() => {
    if (!uid || isAdmin) return;
    let isCurrent = true;
    setState({ uid, join: { status: "joining" } });
    callFunction<Record<string, never>, { result: string }>("join_admin_team", {})
      .then(() => refreshClaims())
      .catch((error) => {
        if (!isCurrent) return;
        setState({ uid, join: { status: "refused", message: describeError(error) } });
      });
    return () => {
      isCurrent = false;
    };
  }, [uid, isAdmin, refreshClaims]);

  return state?.uid === uid ? state.join : { status: "idle" as const };
}
