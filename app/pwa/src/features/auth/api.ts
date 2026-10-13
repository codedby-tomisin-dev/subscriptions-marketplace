import {
  isSignInWithEmailLink,
  onIdTokenChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "@/shared/api";
import { clearPendingEmail, savePendingEmail } from "./storage";

export const COMPLETE_SIGN_IN_PATH = "/auth/complete";

/** Only same-site paths, so a crafted link can't bounce someone to another site. */
export function safeReturnPath(path: string | null | undefined): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/account";
}

export async function sendSignInLink(email: string, returnTo: string): Promise<void> {
  const url = new URL(COMPLETE_SIGN_IN_PATH, window.location.origin);
  url.searchParams.set("next", safeReturnPath(returnTo));
  await sendSignInLinkToEmail(firebaseAuth(), email, { url: url.toString(), handleCodeInApp: true });
  savePendingEmail(email);
}

export function isSignInLink(href: string): boolean {
  return isSignInWithEmailLink(firebaseAuth(), href);
}

export async function completeSignIn(email: string, href: string): Promise<void> {
  await signInWithEmailLink(firebaseAuth(), email, href);
  clearPendingEmail();
}

export function signOut(): Promise<void> {
  return firebaseSignOut(firebaseAuth());
}

export interface AuthSnapshot {
  user: User | null;
  isAdmin: boolean;
}

/** Fires on sign-in, sign-out and token refresh, so a newly granted admin role shows up. */
export function watchAuth(onChange: (snapshot: AuthSnapshot) => void): () => void {
  return onIdTokenChanged(firebaseAuth(), async (user) => {
    if (!user) return onChange({ user: null, isAdmin: false });
    const token = await user.getIdTokenResult();
    onChange({ user, isAdmin: token.claims.role === "admin" });
  });
}

/** Forces a fresh ID token, picking up role changes made since sign-in. */
export async function refreshClaims(): Promise<void> {
  await firebaseAuth().currentUser?.getIdToken(true);
}
