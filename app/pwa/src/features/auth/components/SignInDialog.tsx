"use client";

import { useState, type FormEvent } from "react";
import { Mail, MailCheck } from "lucide-react";
import { Button, Dialog, Input } from "@/components/ui";
import { useSendSignInLink } from "../hooks/useSendSignInLink";
import styles from "./SignInDialog.module.css";

interface SignInDialogProps {
  open: boolean;
  returnTo: string;
  onClose: () => void;
}

export function SignInDialog({ open, returnTo, onClose }: SignInDialogProps) {
  const [email, setEmail] = useState("");
  const { state, sentTo, failure, send, reset } = useSendSignInLink(returnTo);

  const close = () => {
    reset();
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send(email);
  };

  if (state === "sent") {
    return (
      <Dialog open={open} onClose={close} title="Check your inbox" footer={<Button onClick={close}>Got it</Button>}>
        <div className={styles.sent}>
          <MailCheck size={28} aria-hidden className={styles.sentIcon} />
          <p className={styles.sentText}>
            We’ve sent a sign-in link to <b>{sentTo}</b>. Open it on this device and you’ll land right back here.
          </p>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Sign in to Bonbon"
      description="No password needed — we’ll email you a link that signs you straight in."
    >
      <form onSubmit={submit} className={styles.form}>
        <Input
          type="email"
          label="Email"
          value={email}
          onChange={setEmail}
          iconLeft={Mail}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          required
          error={state === "failed" ? failure : undefined}
        />
        <Button type="submit" fullWidth loading={state === "sending"}>
          Email me a sign-in link
        </Button>
      </form>
    </Dialog>
  );
}
