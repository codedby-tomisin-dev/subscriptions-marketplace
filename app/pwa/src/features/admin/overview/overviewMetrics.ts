import { formatCompactPrice } from "@/shared/utils";
import type { Overview } from "../api";

export interface Kpi {
  label: string;
  value: string;
  change: string | null;
  /** true = good news, false = bad, null = neutral. */
  isGood: boolean | null;
  note: string;
}

function percentChange(now: number, before: number | undefined): string | null {
  if (!before) return null;
  const change = ((now - before) / before) * 100;
  return `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}%`;
}

/** The four headline tiles, compared with the snapshot from about a month ago. */
export function overviewKpis(overview: Overview): Kpi[] {
  const { current, previous, shipping } = overview;
  const churnChange = previous ? (current.churnRate - previous.churnRate) * 100 : null;
  return [
    {
      label: "Active subscriptions",
      value: current.activeSubscriptions.toLocaleString("en-GB"),
      change: percentChange(current.activeSubscriptions, previous?.activeSubscriptions),
      isGood: previous ? current.activeSubscriptions >= previous.activeSubscriptions : null,
      note: "vs a month ago",
    },
    {
      label: "Monthly recurring revenue",
      value: formatCompactPrice(current.mrrPence),
      change: percentChange(current.mrrPence, previous?.mrrPence),
      isGood: previous ? current.mrrPence >= previous.mrrPence : null,
      note: "vs a month ago",
    },
    {
      label: "Monthly churn",
      value: `${(current.churnRate * 100).toFixed(1)}%`,
      change: churnChange == null ? null : `${churnChange <= 0 ? "−" : "+"}${Math.abs(churnChange).toFixed(1)} pts`,
      isGood: churnChange == null ? null : churnChange <= 0,
      note: "lower is better",
    },
    {
      label: "Boxes shipping this week",
      value: shipping.total.toLocaleString("en-GB"),
      change: `${shipping.packed} packed`,
      isGood: null,
      note: `of ${shipping.total}`,
    },
  ];
}

/** One line on where weekly is most popular. */
export function cadenceInsight(cadenceByBox: Overview["cadenceByBox"], boxName: (boxId: string) => string | undefined): string | null {
  const shares = Object.entries(cadenceByBox)
    .filter(([boxId, counts]) => boxId !== "all" && counts.week + counts.month > 0)
    .map(([boxId, counts]) => ({ name: boxName(boxId) ?? boxId, weekly: counts.week / (counts.week + counts.month) }));
  if (!shares.length) return null;
  const weeklyWins = shares.filter((share) => share.weekly > 0.5);
  const top = [...shares].sort((a, b) => b.weekly - a.weekly)[0];
  if (weeklyWins.length === 1) return `${top.name} is the only box where weekly wins (${Math.round(top.weekly * 100)}%).`;
  if (!weeklyWins.length) return `Monthly leads for every box; ${top.name} has the most weekly subscribers (${Math.round(top.weekly * 100)}%).`;
  return `Weekly wins for ${weeklyWins.length} boxes, led by ${top.name} (${Math.round(top.weekly * 100)}%).`;
}
