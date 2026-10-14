import type { Box, BoxFact, BoxItem, BoxStatus, Cadence, RitualStep } from "@/features/catalog";
import type { SurfaceTone } from "@/shared/types";
import type { BoxPayload, GeneratedListing } from "./api";

/** A packing item in the form; its cost is pounds text like the prices, blank if unknown. */
export interface DraftItem {
  id?: string;
  name: string;
  inWeeklyBox: boolean;
  cost: string;
}

/** The editor's form state. Prices and costs are edited as pounds text ("19" or "18.50"). */
export interface BoxDraft {
  id?: string;
  name: string;
  tone: SurfaceTone;
  illustration: string | null;
  image: string | null;
  audience: string;
  shotDescription: string;
  prices: Record<Cadence, string>;
  planNotes: Record<Cadence, string>;
  pitch: string;
  story: string;
  facts: BoxFact[];
  ritual: RitualStep[];
  contents: BoxItem[];
  testimonial: { quote: string; attribution: string };
  items: DraftItem[];
  status: BoxStatus;
  sortOrder: number;
}

export const TONES: { value: SurfaceTone; label: string }[] = [
  { value: "blush", label: "Blush" },
  { value: "apricot", label: "Apricot" },
  { value: "sage", label: "Sage" },
  { value: "plum", label: "Plum" },
  { value: "lilac", label: "Lilac" },
  { value: "cream", label: "Cream" },
];

const toPounds = (pence: number) => (pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2));

export function emptyDraft(sortOrder: number): BoxDraft {
  return {
    name: "",
    tone: "blush",
    illustration: null,
    image: null,
    audience: "",
    shotDescription: "",
    prices: { week: "", month: "" },
    planNotes: { week: "", month: "" },
    pitch: "",
    story: "",
    facts: [{ icon: "PackageOpen", label: "" }],
    ritual: [{ title: "", body: "" }],
    contents: [{ name: "", description: "", tone: "cream" }],
    testimonial: { quote: "", attribution: "" },
    items: [{ name: "", inWeeklyBox: true, cost: "" }],
    status: "active",
    sortOrder,
  };
}

export function draftFromBox(box: Box): BoxDraft {
  return {
    ...box,
    prices: { week: toPounds(box.prices.week), month: toPounds(box.prices.month) },
    testimonial: box.testimonial ?? { quote: "", attribution: "" },
    items: box.items.map(({ costPence, ...item }) => ({ ...item, cost: costPence == null ? "" : toPounds(costPence) })),
  };
}

/** A drafted listing as form state. Keeps the pictures and position already in the form. */
export function draftFromListing(listing: GeneratedListing, current: BoxDraft): BoxDraft {
  return {
    ...current,
    ...listing,
    illustration: current.illustration,
    image: current.image,
    prices: { week: toPounds(listing.prices.week), month: toPounds(listing.prices.month) },
    testimonial: { quote: "", attribution: "" },
    items: listing.items.map((item) => ({ name: item.name, inWeeklyBox: item.inWeeklyBox, cost: item.costPence == null ? "" : toPounds(item.costPence) })),
    status: current.status,
  };
}

/** "18.50" → 1850; null if it isn't a price. */
export function parsePounds(text: string): number | null {
  const cleaned = text.replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export interface PlanEconomics {
  /** Null while the price doesn't parse. */
  price: number | null;
  /** The plan's items that have a cost, summed. */
  cost: number;
  /** Items in this plan with no cost yet, so the sum is short. */
  uncosted: number;
  profit: number | null;
  /** Profit as a share of the price, 0–1. */
  margin: number | null;
}

/** Price, item cost and profit per plan, from the form as typed. Weekly boxes hold the ticked items; monthly hold them all. */
export function planEconomics(draft: Pick<BoxDraft, "prices" | "items">): Record<Cadence, PlanEconomics> {
  const plan = (cadence: Cadence): PlanEconomics => {
    const items = draft.items.filter((item) => item.name.trim() && (cadence === "month" || item.inWeeklyBox));
    const costs = items.map((item) => parsePounds(item.cost));
    const cost = costs.reduce<number>((sum, pence) => sum + (pence ?? 0), 0);
    const price = parsePounds(draft.prices[cadence]);
    const profit = price === null ? null : price - cost;
    return { price, cost, uncosted: costs.filter((pence) => pence === null).length, profit, margin: price && profit !== null ? profit / price : null };
  };
  return { week: plan("week"), month: plan("month") };
}

/** Turns the form into what admin_save_box expects, dropping blank rows. Returns an error message if prices don't parse. */
export function payloadFromDraft(draft: BoxDraft): { payload: BoxPayload } | { error: string } {
  const week = parsePounds(draft.prices.week);
  const month = parsePounds(draft.prices.month);
  if (week === null || month === null) return { error: "Enter both prices in pounds, e.g. 19 or 18.50." };
  const filled = (text: string) => text.trim().length > 0;
  const items = draft.items.filter((item) => filled(item.name));
  if (items.some((item) => filled(item.cost) && parsePounds(item.cost) === null)) return { error: "Enter item costs in pounds, e.g. 3.50, or leave them blank." };
  const testimonial = filled(draft.testimonial.quote) ? draft.testimonial : null;
  return {
    payload: {
      ...draft,
      prices: { week, month },
      facts: draft.facts.filter((fact) => filled(fact.label)),
      ritual: draft.ritual.filter((step) => filled(step.title) || filled(step.body)),
      contents: draft.contents.filter((item) => filled(item.name)),
      items: items.map(({ cost, ...item }) => ({ ...item, costPence: filled(cost) ? parsePounds(cost) : null })),
      testimonial,
    },
  };
}
