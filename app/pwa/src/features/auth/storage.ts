// The email a sign-in link was sent to. Firebase needs it again when the link
// is opened, and localStorage (unlike sessionStorage) survives the link
// opening in a new tab. Storage can throw in private windows, hence the guards.
const PENDING_EMAIL_KEY = "bonbon.signInEmail";

export function readPendingEmail(): string | null {
  try {
    return window.localStorage.getItem(PENDING_EMAIL_KEY);
  } catch {
    return null;
  }
}

export function savePendingEmail(email: string): void {
  try {
    window.localStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // Without storage the customer is asked for their email again on return.
  }
}

export function clearPendingEmail(): void {
  try {
    window.localStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Nothing to clear.
  }
}
