import { useCallback, useState } from "react";
import { FirebaseError } from "firebase/app";
import { sendSignInLink } from "../api";

type SendState = "idle" | "sending" | "sent" | "failed";

const FAILURE_MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That doesn’t look like an email address. Check it and try again.",
  "auth/network-request-failed": "We couldn’t reach the sign-in service. Check your connection and try again.",
  "auth/operation-not-allowed": "Email sign-in links aren’t switched on for this project yet.",
  "auth/unauthorized-continue-uri": "This site isn’t on the project’s authorised domains yet.",
  "auth/unauthorized-domain": "This site isn’t on the project’s authorised domains yet.",
  "auth/quota-exceeded": "Too many sign-in emails just now. Try again in a few minutes.",
};
const DEFAULT_FAILURE = "We couldn’t send that link. Try again in a moment.";

export function useSendSignInLink(returnTo: string) {
  const [state, setState] = useState<SendState>("idle");
  const [sentTo, setSentTo] = useState("");
  const [failure, setFailure] = useState(DEFAULT_FAILURE);

  const send = useCallback(
    async (email: string) => {
      setState("sending");
      try {
        await sendSignInLink(email.trim(), returnTo);
        setSentTo(email.trim());
        setState("sent");
      } catch (error) {
        const code = error instanceof FirebaseError ? error.code : "unknown";
        // The code is the useful part when diagnosing setup problems (emulators, console settings).
        console.error("Sign-in link failed:", code, error);
        setFailure(FAILURE_MESSAGES[code] ?? DEFAULT_FAILURE);
        setState("failed");
      }
    },
    [returnTo],
  );

  const reset = useCallback(() => setState("idle"), []);

  return { state, sentTo, failure, send, reset };
}
