import { useCallback, useState } from "react";
import { useToast } from "@/components/ui";
import { useCatalog } from "@/features/catalog";
import { manageSubscription, type Subscription, type SubscriptionAction } from "@/features/subscriptions";
import { describeError } from "@/shared/api";
import { formatDay, formatShortDate } from "@/shared/utils";
import { refundOrder } from "../api";

/** Changes the team makes on a subscriber's behalf. Same server rules as the customer's own; the event log records who did it. */
export function useAdminSubscriptionActions(customerFirstName: string) {
  const { showToast } = useToast();
  const { getBox } = useCatalog();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = useCallback(
    async (id: string, task: () => Promise<{ title: string; message?: string; actionLabel?: string; onAction?: () => void }>) => {
      setBusyId(id);
      try {
        showToast(await task());
      } catch (error) {
        showToast({ tone: "danger", title: "That didn’t go through", message: describeError(error) });
      } finally {
        setBusyId(null);
      }
    },
    [showToast],
  );

  const change = useCallback(
    (subscription: Subscription, action: SubscriptionAction, describe: (updated: Subscription) => { title: string; message?: string }, undo?: SubscriptionAction) =>
      run(subscription.id, async () => {
        const updated = await manageSubscription(subscription.id, action);
        return {
          ...describe(updated),
          ...(undo && { actionLabel: "Undo", onAction: () => change(updated, undo, () => ({ title: "Undone" })) }),
        };
      }),
    [run],
  );

  const boxName = (subscription: Subscription) => getBox(subscription.boxId)?.name ?? subscription.boxId;

  return {
    busyId,
    skipNext: (subscription: Subscription) =>
      change(
        subscription,
        { action: "skip_next" },
        (updated) => ({
          title: `Next ${boxName(subscription)} box skipped`,
          message: `${formatDay(updated.skippedDelivery ?? "")} won’t be sent or charged. Let ${customerFirstName} know.`,
        }),
        { action: "unskip" },
      ),
    pause: (subscription: Subscription) =>
      change(subscription, { action: "pause" }, (updated) => ({ title: "Paused", message: `Until ${formatShortDate(updated.resumesOn ?? "")}.` })),
    resume: (subscription: Subscription) =>
      change(subscription, { action: "resume" }, (updated) => ({ title: "Resumed", message: `Next box ${formatDay(updated.nextDelivery ?? "")}.` })),
    cancel: (subscription: Subscription) =>
      change(subscription, { action: "cancel" }, () => ({ title: "Subscription cancelled" }), { action: "undo_cancel" }),
    refund: (orderId: string, pricePence: string) =>
      run(orderId, async () => {
        await refundOrder(orderId);
        return { title: `${orderId} refunded`, message: `${pricePence} back to ${customerFirstName}’s card.` };
      }),
  };
}
