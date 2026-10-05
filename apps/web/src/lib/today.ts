// One shared definition of "today" for show dates.
//
// Show dates are stored as plain calendar dates (midnight UTC). The server
// clock is UTC, so comparing against the server's own midnight would roll a
// show into "the past" at 8pm Eastern on the night it happens. Until shows
// carry their own time zone, the calendar day is taken in US Eastern time,
// where the pilot runs.
const ZONE = "America/New_York";

// Today's calendar date in the product time zone, as YYYY-MM-DD.
export function todayIso(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// The stored-date value for today: shows with `date >= startOfToday()` are
// today's or later.
export function startOfToday(now: Date = new Date()): Date {
  return new Date(`${todayIso(now)}T00:00:00.000Z`);
}

// Whole days from today to a stored show date (0 = today, negative = past).
export function daysFromToday(showDate: Date, now: Date = new Date()): number {
  return Math.round((Date.parse(showDate.toISOString().slice(0, 10)) - startOfToday(now).getTime()) / 86_400_000);
}
