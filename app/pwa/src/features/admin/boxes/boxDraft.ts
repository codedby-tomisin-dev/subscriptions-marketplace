import { boxOptions, PURCHASE_COPY, PURCHASE_OPTIONS, type Box, type BoxFact, type BoxItem, type BoxStatus, type PurchaseOption, type RitualStep } from "@/features/catalog";
import type { SurfaceTone } from "@/shared/types";
import type { BoxPayload, GeneratedListing } from "./api";
import { DELIVERY_PENCE, PACKAGING_PENCE, suggestedPricePence } from "./pricing";

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
  video: string | null;
  audience: string;
  shotDescription: string;
  /** Which ways the box is on sale. A price or note for an option that's off is kept in the form but not saved. */
  onSale: Record<PurchaseOption, boolean>;
  prices: Record<PurchaseOption, string>;
  planNotes: Record<PurchaseOption, string>;
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

export const toPounds = (pence: number) => (pence % 100 === 0 ? String(pence / 100) : (pence / 100).toFixed(2));

export function emptyDraft(sortOrder: number): BoxDraft {
  return {
    name: "",
    tone: "blush",
    illustration: null,
    image: null,
    video: null,
    audience: "",
    shotDescription: "",
    onSale: { week: true, month: true, once: false },
    prices: { week: "", month: "", once: "" },
    planNotes: { week: "", month: "", once: "" },
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

const byOption = <T,>(value: (option: PurchaseOption) => T) =>
  Object.fromEntries(PURCHASE_OPTIONS.map((option) => [option, value(option)])) as Record<PurchaseOption, T>;

const poundsOrBlank = (pence: number | undefined) => (pence === undefined ? "" : toPounds(pence));

export function draftFromBox(box: Box): BoxDraft {
  const options = boxOptions(box);
  return {
    ...box,
    video: box.video ?? null, // boxes saved before videos existed have no field
    onSale: byOption((option) => options.includes(option)),
    prices: byOption((option) => poundsOrBlank(box.prices[option])),
    planNotes: byOption((option) => box.planNotes[option] ?? ""),
    testimonial: box.testimonial ?? { quote: "", attribution: "" },
    items: box.items.map(({ costPence, ...item }) => ({ ...item, cost: costPence == null ? "" : toPounds(costPence) })),
  };
}

/** A drafted listing as form state. Keeps the pictures, position and one-off settings already in the form. */
export function draftFromListing(listing: GeneratedListing, current: BoxDraft): BoxDraft {
  return {
    ...current,
    ...listing,
    illustration: current.illustration,
    image: current.image,
    video: current.video,
    // The agent drafts weekly and monthly plans; the one-off stays as the form had it.
    onSale: { week: true, month: true, once: current.onSale.once },
    prices: { ...current.prices, week: poundsOrBlank(listing.prices.week), month: poundsOrBlank(listing.prices.month) },
    planNotes: { ...current.planNotes, week: listing.planNotes.week ?? "", month: listing.planNotes.month ?? "" },
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
  /** Delivery and packaging, per box. */
  shipping: number;
  /** What the pricing rule says to charge: goods + 30%, delivery and packaging. */
  suggested: number;
  /** After goods, delivery and packaging. */
  profit: number | null;
  /** Profit as a share of the price, 0–1. */
  margin: number | null;
}

/** Price, item cost and profit per option, from the form as typed. Weekly boxes hold the ticked items; monthly and one-off hold them all. */
export function planEconomics(draft: Pick<BoxDraft, "prices" | "items">): Record<PurchaseOption, PlanEconomics> {
  return byOption((option): PlanEconomics => {
    const items = draft.items.filter((item) => item.name.trim() && (option !== "week" || item.inWeeklyBox));
    const costs = items.map((item) => parsePounds(item.cost));
    const cost = costs.reduce<number>((sum, pence) => sum + (pence ?? 0), 0);
    const price = parsePounds(draft.prices[option]);
    const shipping = DELIVERY_PENCE + PACKAGING_PENCE;
    const profit = price === null ? null : price - cost - shipping;
    return {
      price,
      cost,
      uncosted: costs.filter((pence) => pence === null).length,
      shipping,
      suggested: suggestedPricePence(cost),
      profit,
      margin: price && profit !== null ? profit / price : null,
    };
  });
}

export const draftOptions = (draft: Pick<BoxDraft, "onSale">) => PURCHASE_OPTIONS.filter((option) => draft.onSale[option]);

/** Turns the form into what admin_save_box expects, dropping blank rows and options that aren't on sale. Returns an error message if prices don't parse. */
export function payloadFromDraft(draft: BoxDraft): { payload: BoxPayload } | { error: string } {
  const options = draftOptions(draft);
  if (!options.length) return { error: "Put the box on sale at least one way: weekly, monthly or one-off." };
  const prices: BoxPayload["prices"] = {};
  const planNotes: BoxPayload["planNotes"] = {};
  for (const option of options) {
    const price = parsePounds(draft.prices[option]);
    if (price === null) return { error: `Enter the ${PURCHASE_COPY[option].label.toLowerCase()} price in pounds, e.g. 19 or 18.50.` };
    prices[option] = price;
    planNotes[option] = draft.planNotes[option];
  }
  const filled = (text: string) => text.trim().length > 0;
  const items = draft.items.filter((item) => filled(item.name));
  if (items.some((item) => filled(item.cost) && parsePounds(item.cost) === null)) return { error: "Enter item costs in pounds, e.g. 3.50, or leave them blank." };
  const testimonial = filled(draft.testimonial.quote) ? draft.testimonial : null;
  // Which options are on sale is saved as which ones have a price.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { onSale, ...fields } = draft;
  return {
    payload: {
      ...fields,
      prices,
      planNotes,
      facts: draft.facts.filter((fact) => filled(fact.label)),
      ritual: draft.ritual.filter((step) => filled(step.title) || filled(step.body)),
      contents: draft.contents.filter((item) => filled(item.name)),
      items: items.map(({ cost, ...item }) => ({ ...item, costPence: filled(cost) ? parsePounds(cost) : null })),
      testimonial,
    },
  };
}
