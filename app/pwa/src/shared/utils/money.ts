const CURRENCY = "GBP";

const wholePounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const withPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: CURRENCY, minimumFractionDigits: 2 });

/** Formats an amount in pence as pounds: 1900 → "£19", 1250 → "£12.50". */
export function formatPrice(pence: number): string {
  const pounds = pence / 100;
  return Number.isInteger(pounds) ? wholePounds.format(pounds) : withPence.format(pounds);
}

/** Large amounts for dashboards: 3_840_000 → "£38.4k". */
export function formatCompactPrice(pence: number): string {
  const pounds = pence / 100;
  if (pounds < 1000) return formatPrice(Math.round(pounds) * 100);
  return `£${(pounds / 1000).toFixed(1).replace(/\.0$/, "")}k`;
}
