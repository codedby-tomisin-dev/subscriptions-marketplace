import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/components/ui";
import { CADENCE_COPY, type Cadence } from "@/features/catalog";
import { manageSubscription, nextBoxArrives, type Subscription, type SubscriptionAction } from "@/features/subscriptions";
import { describeError } from "@/shared/api";
import { formatDay, formatShortDate } from "@/shared/utils";

type ToastOptions = Parameters<ReturnType<typeof useToast>["showToast"]>[0];

/**
 * Member-facing subscription changes. Each goes to the server; the live listener
 * shows the result, and a toast confirms it (with undo where that's cheap).
 */
export function useSubscriptionActions() {
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const run = useCallback(
    async (subscription: Subscription, change: SubscriptionAction, confirm: (updated: Subscription) => ToastOptions) => {
      setBusyId(subscription.id);
      try {
        showToast(confirm(await manageSubscription(subscription.id, change)));
      } catch (error) {
        showToast({ tone: "danger", title: "That didn’t go through", message: describeError(error) });
      } finally {
        setBusyId(null);
      }
    },
    [showToast],
  );

  const actions = useMemo(
    () => ({
      changeCadence(subscription: Subscription, cadence: Cadence, retention = false) {
        if (cadence === subscription.cadence) return;
        return run(subscription, { action: "change_cadence", cadence, retention }, (updated) => ({
          tone: "success",
          title: `Switched to ${CADENCE_COPY[cadence].adjective.toLowerCase()}`,
          message: updated.nextDelivery ? `Starts from your ${formatDay(updated.nextDelivery)} box.` : undefined,
        }));
      },

      skipNext(subscription: Subscription) {
        return run(subscription, { action: "skip_next" }, (updated) => ({
          title: `${formatDay(updated.skippedDelivery ?? "")} skipped`,
          message: "We’ll see you next time. We’ll miss you a normal amount.",
          actionLabel: "Undo",
          onAction: () => run(updated, { action: "unskip" }, () => ({ tone: "success", title: "Box back on" })),
        }));
      },

      pause(subscription: Subscription, retention = false) {
        return run(subscription, { action: "pause", retention }, (updated) => ({
          title: `Paused until ${formatShortDate(updated.resumesOn ?? "")}`,
          message: updated.packedDelivery
            ? `Your ${formatDay(updated.packedDelivery)} box is already packed, so that one still arrives.`
            : "We’ll keep your spot warm.",
        }));
      },

      resume(subscription: Subscription) {
        return run(subscription, { action: "resume" }, (updated) => ({
          tone: "success",
          title: "You’re back",
          message: `Next box arrives ${formatDay(nextBoxArrives(updated) ?? "")}.`,
        }));
      },

      restart(subscription: Subscription) {
        return run(subscription, { action: "restart" }, (updated) => ({
          tone: "success",
          title: "Welcome back",
          message: `Your next box arrives ${formatDay(nextBoxArrives(updated) ?? "")}.`,
        }));
      },

      cancel(subscription: Subscription, boxName: string, reason: string | null) {
        return run(subscription, { action: "cancel", reason: reason ?? undefined }, (updated) => ({
          title: `${boxName} cancelled`,
          message: updated.finalDelivery
            ? `Your ${formatDay(updated.finalDelivery)} box is already packed — it’s still coming.`
            : "Thanks for having us.",
          actionLabel: "Undo",
          onAction: () => run(updated, { action: "undo_cancel" }, () => ({ tone: "success", title: `${boxName} is back on` })),
        }));
      },
    }),
    [run],
  );

  return { ...actions, busyId };
}

export type SubscriptionActions = ReturnType<typeof useSubscriptionActions>;
