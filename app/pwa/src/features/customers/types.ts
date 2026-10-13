import type { Cadence } from "@/features/catalog";
import type { SubscriptionStatus } from "@/features/subscriptions";

export interface ShippingAddress {
  line1: string;
  line2: string | null;
  city: string;
  postalCode: string;
  country: string;
}

/** `customers/{uid}`. The summary fields are kept in step with the customer's subscriptions by the backend. */
export interface Customer {
  id: string;
  email: string;
  name: string | null;
  city: string | null;
  shippingAddress: ShippingAddress | null;
  /** ISO month, e.g. "2026-03". */
  memberSince: string;
  ltvPence: number;
  subscriptionSummary: { boxId: string; cadence: Cadence; status: SubscriptionStatus }[];
  /** ISO date of the customer's next box across all subscriptions. */
  nextDelivery: string | null;
  overallStatus: SubscriptionStatus | "none";
  createdAt: string;
}

/** "Maya Okafor" → "Maya"; falls back to the email's local part before checkout has given us a name. */
export function firstName(customer: Pick<Customer, "name" | "email"> | null, fallbackEmail?: string | null): string | null {
  const name = customer?.name?.trim();
  if (name) return name.split(/\s+/)[0];
  const email = customer?.email ?? fallbackEmail;
  return email ? email.split("@")[0] : null;
}
