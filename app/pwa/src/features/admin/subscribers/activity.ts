import { CircleX, CreditCard, PackageCheck, Pause, Play, ReceiptText, Repeat, RotateCcw, SkipForward, Sparkles, type LucideIcon } from "lucide-react";
import { formatPrice, formatShortDate } from "@/shared/utils";
import type { ActivityEvent } from "./api";

/** One line of the drawer's "Recent activity" for an event. */
export function describeActivity(event: ActivityEvent, boxName: (boxId: string) => string | undefined): { icon: LucideIcon; text: string } {
  const box = boxName(String(event.data.boxId ?? "")) ?? "box";
  const amount = typeof event.data.amountPence === "number" ? formatPrice(event.data.amountPence) : "";
  const byTeam = event.actor !== event.customerId && event.actor !== "stripe" && event.actor !== "system" ? " (by the team)" : "";
  switch (event.type) {
    case "subscription_created":
      return { icon: Sparkles, text: `Started ${box}` };
    case "cadence_changed":
      return { icon: Repeat, text: `Switched ${box} to ${event.data.to === "week" ? "weekly" : "monthly"}${event.data.retention ? " instead of cancelling" : ""}${byTeam}` };
    case "skipped":
      return { icon: SkipForward, text: `Skipped the ${formatShortDate(String(event.data.delivery))} ${box} box${byTeam}` };
    case "unskipped":
      return { icon: RotateCcw, text: `Brought back a skipped ${box} box${byTeam}` };
    case "paused":
      return { icon: Pause, text: `Paused ${box}${event.data.retention ? " instead of cancelling" : ""}${byTeam}` };
    case "resumed":
      return { icon: Play, text: `Resumed ${box}${byTeam}` };
    case "cancelled":
      return { icon: CircleX, text: `Cancelled ${box}${event.data.reason ? ` · “${event.data.reason}”` : ""}${event.actor === "stripe" ? " (payment failed)" : byTeam}` };
    case "cancel_undone":
      return { icon: RotateCcw, text: `Kept ${box} after all${byTeam}` };
    case "restarted":
      return { icon: RotateCcw, text: `Restarted ${box}${byTeam}` };
    case "payment_paid":
      return { icon: CreditCard, text: `Paid ${amount} via Stripe` };
    case "payment_failed":
      return { icon: CreditCard, text: `Payment of ${amount} failed` };
    case "refunded":
      return { icon: ReceiptText, text: `Refunded ${event.data.orderId} · ${amount}` };
    case "order_delivered":
      return { icon: PackageCheck, text: `${box} delivered` };
    default:
      return { icon: Sparkles, text: event.type };
  }
}
