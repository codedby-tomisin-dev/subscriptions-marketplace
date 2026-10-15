/**
 * How a box is priced: what its goods cost in the shops, plus 30% for the experience
 * (our service), plus delivery and packaging, rounded up to the next 50p.
 * Mirrors cloud/functions/modules/catalog/pricing.py (its tests check these numbers match).
 */
export const SERVICE_MARKUP_PERCENT = 30;
export const DELIVERY_PENCE = 375;
export const PACKAGING_PENCE = 100;
export const ROUND_UP_TO_PENCE = 50;

/** Goods (the items' average supermarket prices, summed) → the box's price, in pence. */
export function suggestedPricePence(goodsPence: number): number {
  // In hundredths of a penny, so the 30% stays exact.
  const exact = goodsPence * (100 + SERVICE_MARKUP_PERCENT) + (DELIVERY_PENCE + PACKAGING_PENCE) * 100;
  return Math.ceil(exact / (ROUND_UP_TO_PENCE * 100)) * ROUND_UP_TO_PENCE;
}
