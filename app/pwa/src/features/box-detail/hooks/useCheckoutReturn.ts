import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSubscriptions, type Subscription } from "@/features/subscriptions";

/**
 * Stripe sends subscribers back to `/boxes/{id}?checkout={subscriptionId}`. The
 * subscription appears once Stripe's webhook has landed, usually within seconds.
 * One-off buyers come back to `?bought={deliveryDate}`: Stripe only sends them once
 * they've paid, so there's nothing to wait for.
 */
export function useCheckoutReturn() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const checkoutId = params.get("checkout");
  const boughtFor = params.get("bought");
  const { subscriptions } = useSubscriptions();

  const started: Subscription | null = useMemo(
    () => (checkoutId ? (subscriptions.find((subscription) => subscription.id === checkoutId) ?? null) : null),
    [checkoutId, subscriptions],
  );

  const dismiss = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  return { isWaiting: !!checkoutId && !started, started, boughtFor, dismiss };
}
