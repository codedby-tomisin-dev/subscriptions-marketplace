import { collection, onSnapshot, query, where } from "firebase/firestore";
import type { Cadence } from "@/features/catalog";
import { callFunction, firestore } from "@/shared/api";
import type { Subscription, SubscriptionAction } from "./types";

const toSubscription = (id: string, data: object) => ({ id, ...data }) as Subscription;

/** Live list of one customer's subscriptions, newest first. Returns the unsubscribe function. */
export function watchSubscriptions(customerId: string, onChange: (subscriptions: Subscription[]) => void, onError: (error: Error) => void) {
  const mine = query(collection(firestore(), "subscriptions"), where("customerId", "==", customerId));
  return onSnapshot(
    mine,
    (snapshot) => {
      const subscriptions = snapshot.docs.map((item) => toSubscription(item.id, item.data()));
      onChange(subscriptions.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    },
    onError,
  );
}

export async function manageSubscription(subscriptionId: string, change: SubscriptionAction): Promise<Subscription> {
  const result = await callFunction<SubscriptionAction & { subscriptionId: string }, { subscription: Subscription }>("manage_subscription", {
    subscriptionId,
    ...change,
  });
  return result.subscription;
}

export interface CheckoutInput {
  boxId: string;
  cadence: Cadence;
  firstDelivery: string;
  isGift: boolean;
}

/** Returns the Stripe Checkout URL to send the customer to. */
export async function createCheckoutSession(input: CheckoutInput): Promise<string> {
  const { url } = await callFunction<CheckoutInput, { url: string }>("create_checkout_session", input);
  return url;
}
