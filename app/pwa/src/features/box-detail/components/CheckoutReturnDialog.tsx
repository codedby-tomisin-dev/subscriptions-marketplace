"use client";

import type { Box } from "@/features/catalog";
import { useCheckoutReturn } from "../hooks/useCheckoutReturn";
import { SubscriptionStartedDialog } from "./SubscriptionStartedDialog";

/** Shown when Stripe Checkout sends the customer back to this box's page. */
export function CheckoutReturnDialog({ box }: { box: Box }) {
  const { isWaiting, started, dismiss } = useCheckoutReturn();
  return <SubscriptionStartedDialog box={box} isWaiting={isWaiting} subscription={started} onClose={dismiss} />;
}
