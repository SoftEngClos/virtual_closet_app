// lib/calendarTags.ts

export type OccasionTag =
  | "weekday"
  | "weekend"
  | "work"
  | "casual"
  | "cold"
  | "mild"
  | "hot";

/**
 * Normalize any input into a valid Date.
 */
function normalizeToDate(input: Date | string | null | undefined): Date {
  // Already a Date?
  if (input instanceof Date && !Number.isNaN(input.getTime())) {
    return input;
  }

  // ISO or "YYYY-MM-DD" string?
  if (typeof input === "string" && input.trim().length > 0) {
    const parts = input.split("-");
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) return d;
    }

    const d2 = new Date(input);
    if (!Number.isNaN(d2.getTime())) return d2;
  }

  // Fallback: today
  return new Date();
}

/**
 * Given a Date (or date-like input), infer simple "occasion" and "season" tags.
 */
export function getOccasionTagsForDate(
  rawDate: Date | string | null | undefined
): OccasionTag[] {
  const date = normalizeToDate(rawDate); // 👈 guarantees a real Date

  const tags: OccasionTag[] = [];

  const day = date.getDay();   // 0 = Sun, 6 = Sat
  const month = date.getMonth(); // 0 = Jan

  // Weekday vs weekend
  if (day === 0 || day === 6) {
    tags.push("weekend", "casual");
  } else {
    tags.push("weekday", "work");
  }

  // Very rough "temperature" tags by month (tweak for your climate)
  if (month === 11 || month <= 1) {
    tags.push("cold");
  } else if (month >= 5 && month <= 8) {
    tags.push("hot");
  } else {
    tags.push("mild");
  }

  // Deduplicate
  return Array.from(new Set(tags));
}
