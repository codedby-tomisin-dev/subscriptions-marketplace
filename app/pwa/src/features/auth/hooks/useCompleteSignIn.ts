import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeSignIn, isSignInLink, safeReturnPath } from "../api";
import { readPendingEmail } from "../storage";

type CompleteState = "checking" | "needsEmail" | "signingIn" | "invalidLink" | "failed";

/** Finishes an email-link sign-in, then sends the customer back where they started. */
export function useCompleteSignIn() {
  const router = useRouter();
  const returnTo = safeReturnPath(useSearchParams().get("next"));
  const [state, setState] = useState<CompleteState>("checking");

  const finish = useCallback(
    async (email: string) => {
      setState("signingIn");
      try {
        await completeSignIn(email, window.location.href);
        router.replace(returnTo);
      } catch {
        setState("failed");
      }
    },
    [returnTo, router],
  );

  useEffect(() => {
    if (!isSignInLink(window.location.href)) return setState("invalidLink");
    const email = readPendingEmail();
    if (email) finish(email);
    else setState("needsEmail");
  }, [finish]);

  return { state, finish };
}
