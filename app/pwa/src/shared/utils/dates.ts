/**
 * Calendar helpers. Dates are stored as local ISO strings ("2026-10-15")
 * and months as "2026-10", so they serialise cleanly and sort lexically.
 */

export function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseISODate(iso: string): Date {
  const [year, month, day = 1] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export const toISOMonth = (iso: string) => iso.slice(0, 7);

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

/** Adds calendar months, clamping to the last day (Jan 31 + 1 → Feb 28). */
export function addMonths(iso: string, months: number): string {
  const date = parseISODate(iso);
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(date.getDate(), lastDay));
  return toISODate(target);
}

export const firstOfMonth = (iso: string) => `${toISOMonth(iso)}-01`;

const dayFormat = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
const shortDateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const monthYearFormat = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
const monthNameFormat = new Intl.DateTimeFormat("en-US", { month: "long" });

/** "Thu, Oct 15" */
export const formatDay = (iso: string) => dayFormat.format(parseISODate(iso));
/** "Oct 15" */
export const formatShortDate = (iso: string) => shortDateFormat.format(parseISODate(iso));
/** "Oct 2026" — accepts a date or a month string. */
export const formatMonthYear = (iso: string) => monthYearFormat.format(parseISODate(iso));
/** "December" */
export const formatMonthName = (iso: string) => monthNameFormat.format(parseISODate(iso));

/** Next delivery slots: weekdays only, starting `leadDays` out to allow for packing. */
export function upcomingDeliveryDates(today: Date, count = 4, leadDays = 3): string[] {
  const dates: string[] = [];
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate() + leadDays);
  while (dates.length < count) {
    const weekday = cursor.getDay();
    if (weekday !== 0 && weekday !== 6) dates.push(toISODate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}
