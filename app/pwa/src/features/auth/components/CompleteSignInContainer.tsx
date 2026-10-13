"use client";

import { useState, type FormEvent } from "react";
import { LoaderCircle, Mail } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useAuth } from "../AuthProvider";
import { useCompleteSignIn } from "../hooks/useCompleteSignIn";
import styles from "./CompleteSignIn.module.css";

export function CompleteSignInContainer() {
  const { state, finish } = useCompleteSignIn();
  const { openSignIn } = useAuth();
  const [email, setEmail] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    finish(email.trim());
  };

  return (
    <main className={`bb-container-narrow ${styles.page}`}>
      {(state === "checking" || state === "signingIn") && (
        <p className={styles.status} role="status">
          <LoaderCircle size={20} className={styles.spinner} aria-hidden />
          Signing you in…
        </p>
      )}

      {state === "needsEmail" && (
        <form onSubmit={submit} className={styles.card}>
          <h1 className="bb-heading">Confirm your email</h1>
          <p className={styles.body}>You opened the link on a different device or browser. Which email did you use?</p>
          <Input type="email" label="Email" value={email} onChange={setEmail} iconLeft={Mail} autoComplete="email" autoFocus required />
          <Button type="submit">Sign in</Button>
        </form>
      )}

      {(state === "invalidLink" || state === "failed") && (
        <div className={styles.card}>
          <h1 className="bb-heading">That link has expired</h1>
          <p className={styles.body}>Sign-in links work once, for a short while. We’ll send you a fresh one.</p>
          <Button onClick={() => openSignIn("/account")}>Send a new link</Button>
        </div>
      )}
    </main>
  );
}
