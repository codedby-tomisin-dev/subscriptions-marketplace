import type { Cadence, PurchaseOption } from "./types";

export const CADENCE_COPY: Record<Cadence, { unit: string; short: string; adjective: string }> = {
  week: { unit: "week", short: "wk", adjective: "Weekly" },
  month: { unit: "month", short: "mo", adjective: "Monthly" },
};

/** How each purchase option reads on the box page and in the admin. `unit` follows the price ("£19 / week"). */
export const PURCHASE_COPY: Record<PurchaseOption, { title: string; label: string; unit: string }> = {
  week: { title: "Weekly", label: "Weekly", unit: "week" },
  month: { title: "Monthly", label: "Monthly", unit: "month" },
  // `title` is the customer's card; `label` is the admin's name for it.
  once: { title: "Just once", label: "One-off", unit: "box" },
};

export const isCadence = (option: PurchaseOption): option is Cadence => option !== "once";
