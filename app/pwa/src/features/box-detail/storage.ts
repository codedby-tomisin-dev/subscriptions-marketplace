import type { CheckoutInput } from "@/features/subscriptions";

// Purchase choices made before signing in, so they survive the sign-in email
// (which may open in a new tab, hence localStorage).
const PENDING_PURCHASE_KEY = "bonbon.pendingPurchase";

export function savePendingPurchase(purchase: CheckoutInput): void {
  try {
    window.localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(purchase));
  } catch {
    // The customer just picks again after signing in.
  }
}

/** Reads and forgets the pending purchase for this box, if there is one. */
export function takePendingPurchase(boxId: string): CheckoutInput | null {
  try {
    const raw = window.localStorage.getItem(PENDING_PURCHASE_KEY);
    const purchase = raw ? (JSON.parse(raw) as CheckoutInput) : null;
    if (purchase?.boxId !== boxId) return null;
    window.localStorage.removeItem(PENDING_PURCHASE_KEY);
    return purchase;
  } catch {
    return null;
  }
}
