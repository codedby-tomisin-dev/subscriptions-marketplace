import type { SurfaceTone } from "@/shared/types";

export type Cadence = "week" | "month";

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
}

export type BoxStatus = "active" | "archived";

/** `boxes/{id}`, edited in the admin (cloud/functions/modules/catalog). */
export interface Box {
  id: string;
  name: string;
  tone: SurfaceTone;
  /** Photo URL; falls back to a tinted placeholder. */
  image: string | null;
  /** "For the two of you" */
  audience: string;
  /** Art-direction note shown on the placeholder until photography exists. */
  shotDescription: string;
  /** In pence. What new subscribers pay; existing subscriptions keep their own price. */
  prices: Record<Cadence, number>;
  /** What each cadence includes, e.g. "A mini date · 3 treats". */
  planNotes: Record<Cadence, string>;
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
