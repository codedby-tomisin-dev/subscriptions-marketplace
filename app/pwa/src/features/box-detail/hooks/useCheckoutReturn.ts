import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSubscriptions, type Subscription } from "@/features/subscriptions";

/**
 * Stripe sends customers back to `/boxes/{id}?checkout={subscriptionId}`. The
 * subscription appears once Stripe's webhook has landed, usually within seconds.
 */
export function useCheckoutReturn() {
  const router = useRouter();
  const pathname = usePathname();
  const checkoutId = useSearchParams().get("checkout");
  const { subscriptions } = useSubscriptions();

  const started: Subscription | null = useMemo(
    () => (checkoutId ? (subscriptions.find((subscription) => subscription.id === checkoutId) ?? null) : null),
    [checkoutId, subscriptions],
  );

  const dismiss = useCallback(() => router.replace(pathname, { scroll: false }), [router, pathname]);

  return { isWaiting: !!checkoutId && !started, started, dismiss };
}
