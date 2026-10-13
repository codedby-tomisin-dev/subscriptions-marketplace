"use client";

import type { ReactNode } from "react";
import { LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useJoinAdminTeam } from "./useJoinAdminTeam";
import styles from "./AdminAccessGate.module.css";

/**
 * Shows the admin only to admins. On a fresh project the first person to sign in
 * becomes an admin; after that it's invite-only (cloud/functions/modules/team).
 * This shapes the UI; the real protection is the Firestore rules and the
 * admin-only Cloud Functions.
 */
export function AdminAccessGate({ children }: { children: ReactNode }) {
  const { user, isAdmin, isLoading, openSignIn, refreshClaims, signOut } = useAuth();
  const join = useJoinAdminTeam(user, isAdmin, refreshClaims);

  if (isLoading || (user && !isAdmin && join.status !== "refused")) {
    return (
      <div className={styles.gate} role="status">
        <LoaderCircle size={22} className={styles.spinner} aria-hidden />
      </div>
    );
  }
  if (!user) {
    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <LockKeyhole size={28} aria-hidden />
          <h1 className={styles.title}>Bonbon Ops</h1>
          <p className={styles.body}>Sign in with your team email to continue.</p>
          <Button iconLeft={Mail} onClick={() => openSignIn()}>
            Sign in with email
          </Button>
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className={styles.gate}>
        <div className={styles.card}>
          <LockKeyhole size={28} aria-hidden />
          <h1 className={styles.title}>No access</h1>
          <p className={styles.body}>
            <b>{user.email}</b> isn’t on the ops team. {join.status === "refused" && join.message}
          </p>
          <div className={styles.actions}>
            <Button variant="secondary" onClick={signOut}>
              Sign in as someone else
            </Button>
          </div>
        </div>
      </div>
    );
  }
  return children;
}
