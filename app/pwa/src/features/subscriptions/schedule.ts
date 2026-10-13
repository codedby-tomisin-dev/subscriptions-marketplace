import { addMonths, firstOfMonth, toISODate } from "@/shared/utils";
import type { Subscription } from "./types";

/**
 * Display helpers only. The server decides every real date
 * (cloud/functions/modules/subscriptions/schedule.py).
 */

const PAUSE_MONTHS = 2;

/** When a pause starting today would end — for copy shown before pausing. */
export const pauseResumeDate = (today: Date) => firstOfMonth(addMonths(toISODate(today), PAUSE_MONTHS));

/** The next box to arrive: one already packed, else the next scheduled one. */
export function nextBoxArrives(subscription: Subscription): string | null {
  if (subscription.status === "cancelled") return subscription.finalDelivery;
  if (subscription.packedDelivery) return subscription.packedDelivery;
  return subscription.status === "active" ? subscription.nextDelivery : null;
}
