"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth } from "@/features/auth";
import styles from "./Account.module.css";

export function SignedOutAccount() {
  const { openSignIn } = useAuth();
  return (
    <main className={`bb-container bb-container-narrow ${styles.page}`}>
      <div className={styles.signedOut}>
        <h1 className="bb-heading">Your boxes live here.</h1>
        <p className={styles.summary}>Sign in to skip, pause or change a box, and see where your orders are.</p>
        <Button iconLeft={Mail} onClick={() => openSignIn("/account")}>
          Sign in with email
        </Button>
      </div>
    </main>
  );
}
