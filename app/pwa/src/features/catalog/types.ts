import type { SurfaceTone } from "@/shared/types";

/** How often a subscription delivers. */
export type Cadence = "week" | "month";

/** How a box can be bought: a subscription cadence, or a single box. Chosen per box in the admin. */
export type PurchaseOption = Cadence | "once";

/** Every purchase option, in display order. */
export const PURCHASE_OPTIONS: readonly PurchaseOption[] = ["week", "month", "once"];

export interface BoxFact {
  /** A name from BOX_ICONS, e.g. "Heart". */
  icon: string;
  label: string;
}

export interface RitualStep {
  title: string;
  body: string;
}

/** A row in "What’s inside" on the box page. */
export interface BoxItem {
  name: string;
  description: string;
  tone: SurfaceTone;
}

/** Something that physically goes in the box; its stock is tracked in `inventory/{id}`. */
export interface BoxInventoryItem {
  id: string;
  name: string;
  /** Monthly boxes hold everything; weekly boxes hold the items marked here. */
  inWeeklyBox: boolean;
  /** What one costs us: the average UK supermarket shelf price. Admin only, for profit sums. */
  costPence?: number | null;
}

/** The ways a box is on sale, in display order. */
export const boxOptions = (box: Pick<Box, "prices">): PurchaseOption[] => PURCHASE_OPTIONS.filter((option) => box.prices[option] !== undefined);

/** The cheapest way in, for "from £x" on tiles. */
export function lowestPrice(box: Pick<Box, "prices">): { option: PurchaseOption; pence: number } {
  const [option] = boxOptions(box).sort((a, b) => box.prices[a]! - box.prices[b]!);
  return { option, pence: box.prices[option]! };
}

/** The picture that stands for a box in tiles and thumbnails: its illustration, else its photo. */
export const boxArt = (box: Pick<Box, "illustration" | "image">) => box.illustration ?? box.image;

export type BoxStatus = "active" | "archived";

/** `boxes/{id}`, edited in the admin (cloud/functions/modules/catalog). */
export interface Box {
  id: string;
  name: string;
  tone: SurfaceTone;
  /** Drawn illustration: the box tile and the page's hero. Generated in the admin, or the design's SVGs. */
  illustration: string | null;
  /** Photo URL, uploaded by hand; leads the box page's gallery. Falls back to a tinted placeholder. */
  image: string | null;
  /** A short, silent clip uploaded by hand; when set, it's the box page's one picture. */
  video: string | null;
  /** "For the two of you" */
  audience: string;
  /** Art-direction note shown on the placeholder until photography exists. */
  shotDescription: string;
  /** In pence, for each way the box is on sale. What new customers pay; existing subscriptions keep their own price. */
  prices: Partial<Record<PurchaseOption, number>>;
  /** What each option includes, e.g. "A mini date · 3 treats". */
  planNotes: Partial<Record<PurchaseOption, string>>;
  pitch: string;
  story: string;
  facts: BoxFact[];
  ritual: RitualStep[];
  /** A typical full (monthly) box. */
  contents: BoxItem[];
  testimonial: { quote: string; attribution: string } | null;
  /** The packing recipe. */
  items: BoxInventoryItem[];
  /** Archived boxes leave the storefront; their subscriptions carry on. */
  status: BoxStatus;
  sortOrder: number;
}
