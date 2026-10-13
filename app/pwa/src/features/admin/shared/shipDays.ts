import { addDays, parseISODate, toISODate } from "@/shared/utils";

/** The warehouse's next `count` working days, starting today (or Monday at a weekend). */
export function shipDays(today: Date, count = 5): string[] {
  const days: string[] = [];
  let cursor = toISODate(today);
  while (days.length < count) {
    const weekday = parseISODate(cursor).getDay();
    if (weekday !== 0 && weekday !== 6) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

const shipDayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric" });

/** "Mon 13" */
export const formatShipDay = (iso: string) => shipDayFormat.format(parseISODate(iso));

/** 1284 → "1.3k" */
export function compactCount(count: number): string {
  return count >= 1000 ? `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k` : String(count);
}
