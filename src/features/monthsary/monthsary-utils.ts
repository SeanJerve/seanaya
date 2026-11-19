import { differenceInCalendarDays, format, getDaysInMonth } from "date-fns";

export const DEFAULT_ANNIVERSARY = "2026-06-19";

const NUMBER_WORDS: Record<number, string> = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine",
  10: "ten",
  11: "eleven",
  12: "twelve",
  13: "thirteen",
  14: "fourteen",
  15: "fifteen",
  16: "sixteen",
  17: "seventeen",
  18: "eighteen",
  19: "nineteen",
  20: "twenty",
  21: "twenty-one",
  22: "twenty-two",
  23: "twenty-three",
  24: "twenty-four",
};

export function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function getNumberWord(n: number): string {
  return NUMBER_WORDS[n] || String(n);
}

export function capitalize(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function parseAnniversaryDate(anniversary?: string | null): Date {
  const clean = (anniversary || DEFAULT_ANNIVERSARY).split("T")[0];
  return new Date(`${clean}T00:00:00`);
}

export function getMonthsaryDate(monthNumber: number, anniversary?: string | null): Date {
  const start = parseAnniversaryDate(anniversary);
  const targetYear = start.getFullYear() + Math.floor((start.getMonth() + monthNumber) / 12);
  const targetMonth = (start.getMonth() + monthNumber) % 12;
  const maxDay = getDaysInMonth(new Date(targetYear, targetMonth, 1));
  return new Date(targetYear, targetMonth, Math.min(start.getDate(), maxDay));
}

export function getCurrentMonthsaryNumber(
  anniversary?: string | null,
  referenceDate: Date = new Date(),
): number {
  const start = parseAnniversaryDate(anniversary);
  let months =
    (referenceDate.getFullYear() - start.getFullYear()) * 12 +
    (referenceDate.getMonth() - start.getMonth());
  const thisMonthDay = Math.min(
    start.getDate(),
    getDaysInMonth(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)),
  );
  if (referenceDate.getDate() < thisMonthDay) {
    months -= 1;
  }
  return Math.max(1, months);
}

export function getMonthsaryDetails(
  monthNumber?: number | null,
  anniversary?: string | null,
  now: Date = new Date(),
) {
  const start = parseAnniversaryDate(anniversary);
  const currentMaxMonth = getCurrentMonthsaryNumber(anniversary, now);
  const activeMonth =
    typeof monthNumber === "number" && monthNumber >= 1 ? monthNumber : currentMaxMonth;

  const milestoneDate = getMonthsaryDate(activeMonth, anniversary);
  const isCurrentChapter = activeMonth === currentMaxMonth;
  const effectiveEnd = isCurrentChapter && now > milestoneDate ? now : milestoneDate;
  const daysTogether = Math.max(1, differenceInCalendarDays(effectiveEnd, start));

  const ordinal = getOrdinal(activeMonth);
  const monthWord = getNumberWord(activeMonth);

  return {
    activeMonth,
    currentMaxMonth,
    ordinal,
    monthWord,
    monthWordCap: capitalize(monthWord),
    startDate: start,
    startFormatted: format(start, "MMMM d, yyyy"),
    milestoneDate,
    milestoneDateISO: format(milestoneDate, "yyyy-MM-dd"),
    milestoneShortDate: format(milestoneDate, "MMM d, yyyy"),
    milestoneLongDate: format(milestoneDate, "MMMM d, yyyy"),
    daysTogether,
  };
}

export function resolveMemoryMonthsaryNumber(
  memory?: { title?: string | null; memory_date?: string | null } | null,
  anniversary?: string | null,
): number {
  if (!memory) return getCurrentMonthsaryNumber(anniversary);
  const match = memory.title?.match(/(\d+)(?:st|nd|rd|th)\s+monthsary/i);
  if (match?.[1]) {
    const n = parseInt(match[1], 10);
    if (!Number.isNaN(n) && n >= 1) return n;
  }
  if (memory.memory_date) {
    const d = new Date(`${memory.memory_date.split("T")[0]}T00:00:00`);
    if (!Number.isNaN(d.getTime())) {
      return getCurrentMonthsaryNumber(anniversary, d);
    }
  }
  return getCurrentMonthsaryNumber(anniversary);
}
