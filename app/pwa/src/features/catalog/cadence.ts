import type { Cadence } from "./types";

export const CADENCE_COPY: Record<Cadence, { unit: string; short: string; adjective: string }> = {
  week: { unit: "week", short: "wk", adjective: "Weekly" },
  month: { unit: "month", short: "mo", adjective: "Monthly" },
};
