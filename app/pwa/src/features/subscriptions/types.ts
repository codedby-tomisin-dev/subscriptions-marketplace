import type { Cadence } from "@/features/catalog";

export type SubscriptionStatus = "active" | "paused" | "cancelled";

/** `subscriptions/{id}` as written by the manage_subscription function and Stripe webhooks. */
export interface Subscription {
  id: string;
  customerId: string;
  boxId: string;
  cadence: Cadence;
  status: SubscriptionStatus;
  /** ISO date of the next box that hasn't been charged yet; skip and pause move this one. */
  nextDelivery: string | null;
  /** ISO date of a box that's been charged and is being packed or is on its way. */
  packedDelivery: string | null;
  /** Paused only: ISO date deliveries pick back up. */
  resumesOn: string | null;
  /** ISO month the subscription started, e.g. "2026-06". */
  memberSince: string;
  /** Cancelled only: ISO month it ended. */
  endedOn: string | null;
  /** Cancelled only: a box already charged that still arrives. */
  finalDelivery: string | null;
  isGift: boolean;
  /** What this subscriber pays per box, fixed when they subscribed or last switched rhythm. */
  pricePence: number | null;
  /** The delivery the last skip jumped over (undo brings it back). */
  skippedDelivery: string | null;
  paymentFailed: boolean;
  monthlyValuePence: number;
  createdAt: string;
  updatedAt: string;
}

export type SubscriptionAction =
  | { action: "change_cadence"; cadence: Cadence; retention?: boolean }
  | { action: "skip_next" }
  | { action: "unskip" }
  | { action: "pause"; retention?: boolean }
  | { action: "resume" }
  | { action: "cancel"; reason?: string }
  | { action: "undo_cancel" }
  | { action: "restart" };
