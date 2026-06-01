// Given an artist's confirmed schedule and a nearest anchor show, computes
// concrete open dates around that anchor — so emails can propose specific
// days instead of vague "around that date" asks.
//
// Strategy: stay within 5 days of the anchor show, avoid days where the
// artist has another confirmed show, and score by what day-of-week
// historically works best for the venue type.

import type { Show, VenueType, BlockType } from "@gigify/db";

export type AvailabilityBlock = {
  date: Date;
  type: BlockType;
};

export type AvailableDate = {
  iso: string; // YYYY-MM-DD
  pretty: string; // e.g. "Thursday, June 4"
  isBefore: boolean; // before the anchor show vs after
  dayOfWeek: number; // 0=Sun, 6=Sat
  // Time context — populated when this is a same-day slot around an existing show
  timeContext?: string; // e.g. "evening, after 4 PM" or "morning, before 6 PM"
  sameDayShowName?: string; // e.g. "Newton Porchfest"
};

// Extended show type that includes time data for intraday detection
export type ShowWithTime = {
  id: string;
  date: Date;
  timeStart?: Date | null;
  timeEnd?: Date | null;
  venueName?: string;
};

const MIN_GAP_HOURS = 2.5; // minimum gap between end-of-show and new booking start
const MIN_SLOT_HOURS = 2; // minimum viable slot length to be worth booking

const DAY_MS = 24 * 60 * 60 * 1000;

// Day-of-week preferences by venue type. Higher score = better fit.
// 0=Sun ... 6=Sat
function dayScore(venueType: VenueType, dow: number): number {
  switch (venueType) {
    case "MUSIC_CLUB":
      // Wed-Sat is prime for live music clubs
      return [3, 4, 5, 6].includes(dow) ? 3 : 1;
    case "BAR":
      // Wed-Thu fill quiet weeknights; Fri-Sat usually already busy
      if ([3, 4].includes(dow)) return 3;
      if ([5, 6].includes(dow)) return 2;
      return 1;
    case "RESTAURANT":
      // Thu-Sat dinner service
      return [4, 5, 6].includes(dow) ? 3 : [3, 0].includes(dow) ? 2 : 1;
    case "ARTS_CENTER":
      // Fri-Sat evenings
      return [5, 6].includes(dow) ? 3 : [4, 0].includes(dow) ? 2 : 1;
    case "FARMERS_MARKET":
      // Weekend daytime
      return [6, 0].includes(dow) ? 3 : 1;
    case "FESTIVAL":
      return [5, 6, 0].includes(dow) ? 3 : 1;
    default:
      return [3, 4, 5, 6].includes(dow) ? 2 : 1;
  }
}

function prettyDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Formats an hour (0-23) as "9 AM" / "2:30 PM"
function fmtHour(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  const ampm = h < 12 ? "AM" : "PM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// Detects whether a show day has a usable gap BEFORE or AFTER the show.
// Returns a timeContext string if there's a viable slot, null if fully blocked.
function sameDayTimeContext(
  show: ShowWithTime,
  venueType: VenueType,
): { timeContext: string; timeTag: "morning" | "evening" } | null {
  if (!show.timeEnd && !show.timeStart) return null; // no time data — treat as fully blocked

  // Venue-type preference: music clubs / bars prefer evening; markets prefer morning
  const prefersEvening =
    venueType === "MUSIC_CLUB" || venueType === "BAR" || venueType === "RESTAURANT";

  // Evening slot: show ends early enough that there's room for a 8pm+ booking
  if (show.timeEnd) {
    const endHour = show.timeEnd.getUTCHours() + show.timeEnd.getUTCMinutes() / 60;
    const latestSlotStart = 22 - MIN_SLOT_HOURS; // last reasonable start time
    if (endHour + MIN_GAP_HOURS <= latestSlotStart) {
      const slotStart = endHour + MIN_GAP_HOURS;
      if (prefersEvening || slotStart >= 17) {
        return {
          timeContext: `evening, after ${fmtHour(slotStart)}`,
          timeTag: "evening",
        };
      }
    }
  }

  // Morning/afternoon slot: show starts late enough that there's time before
  if (show.timeStart) {
    const startHour = show.timeStart.getUTCHours() + show.timeStart.getUTCMinutes() / 60;
    const earliestSlotStart = 9; // nothing before 9am
    const slotEnd = startHour - MIN_GAP_HOURS;
    if (slotEnd - earliestSlotStart >= MIN_SLOT_HOURS) {
      return {
        timeContext: `morning, before ${fmtHour(slotEnd)}`,
        timeTag: "morning",
      };
    }
  }

  return null;
}

export function computeAvailableDates(opts: {
  allShows: (Pick<Show, "id" | "date"> & { timeStart?: Date | null; timeEnd?: Date | null; venueName?: string })[];
  nearestShow: Pick<Show, "id" | "date"> & { timeStart?: Date | null; timeEnd?: Date | null; venueName?: string };
  venueType: VenueType;
  availabilityBlocks?: AvailabilityBlock[];
  windowDays?: number;
  count?: number;
}): AvailableDate[] {
  const window = opts.windowDays ?? 5;
  const count = opts.count ?? 3;
  const showTime = opts.nearestShow.date.getTime();

  // Sort shows chronologically, find the chronologically-adjacent ones to bound
  // the open window (don't suggest a date that overlaps another confirmed show).
  const sorted = [...opts.allShows].sort((a, b) => a.date.getTime() - b.date.getTime());
  const idx = sorted.findIndex((s) => s.id === opts.nearestShow.id);
  const prevShowTime = idx > 0 ? sorted[idx - 1].date.getTime() : -Infinity;
  const nextShowTime = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1].date.getTime() : Infinity;

  // Build maps for occupied dates with time data for intraday detection.
  const occupiedDates = new Set(
    sorted.map((s) => s.date.toISOString().slice(0, 10))
  );
  const showByDate = new Map(
    sorted.map((s) => [s.date.toISOString().slice(0, 10), s])
  );

  // Hard-blocked dates — artist explicitly unavailable.
  const hardBlocked = new Set(
    (opts.availabilityBlocks ?? [])
      .filter((b) => b.type === "BLOCKED" || b.type === "TRAVEL")
      .map((b) => b.date.toISOString().slice(0, 10))
  );
  // Soft-blocked — still proposable but score lower.
  const softBlocked = new Set(
    (opts.availabilityBlocks ?? [])
      .filter((b) => b.type === "PREFERRED_OFF")
      .map((b) => b.date.toISOString().slice(0, 10))
  );

  const candidates: AvailableDate[] = [];
  for (let offset = -window; offset <= window; offset++) {
    const ts = showTime + offset * DAY_MS;
    if (ts <= prevShowTime || ts >= nextShowTime) continue;
    const d = new Date(ts);
    const iso = d.toISOString().slice(0, 10);
    if (hardBlocked.has(iso)) continue;

    if (offset === 0) {
      // Anchor show's own day — only add if there's a viable intraday time slot.
      const anchorShow = showByDate.get(iso);
      if (anchorShow) {
        const ctx = sameDayTimeContext(anchorShow, opts.venueType);
        if (ctx) {
          candidates.push({
            iso,
            pretty: prettyDate(d),
            isBefore: false,
            dayOfWeek: d.getUTCDay(),
            timeContext: ctx.timeContext,
            sameDayShowName: anchorShow.venueName ?? undefined,
          });
        }
      }
      continue;
    }

    if (occupiedDates.has(iso)) {
      // Another show day in the window — check intraday slot too.
      const existingShow = showByDate.get(iso);
      if (existingShow) {
        const ctx = sameDayTimeContext(existingShow, opts.venueType);
        if (ctx) {
          candidates.push({
            iso,
            pretty: prettyDate(d),
            isBefore: offset < 0,
            dayOfWeek: d.getUTCDay(),
            timeContext: ctx.timeContext,
            sameDayShowName: existingShow.venueName ?? undefined,
          });
        }
      }
      continue;
    }

    // Fully open day.
    candidates.push({
      iso,
      pretty: prettyDate(d),
      isBefore: offset < 0,
      dayOfWeek: d.getUTCDay(),
    });
  }

  // Rank: best day-of-week for venue type first; soft-blocked days score lower; then closer to anchor.
  candidates.sort((a, b) => {
    const sa = dayScore(opts.venueType, a.dayOfWeek) - (softBlocked.has(a.iso) ? 50 : 0);
    const sb = dayScore(opts.venueType, b.dayOfWeek) - (softBlocked.has(b.iso) ? 50 : 0);
    if (sa !== sb) return sb - sa;
    // Closer to anchor (smaller absolute offset) wins
    const da = Math.abs(new Date(a.iso).getTime() - showTime);
    const db = Math.abs(new Date(b.iso).getTime() - showTime);
    return da - db;
  });

  return candidates.slice(0, count);
}

// Renders a natural English list of dates for the body of an email.
// "Tuesday July 21 or Friday July 24"
// "Wednesday July 22, Friday July 24, or Saturday July 25"
export function renderDateList(dates: AvailableDate[]): string {
  if (dates.length === 0) return "";
  if (dates.length === 1) return dates[0].pretty;
  if (dates.length === 2) return `${dates[0].pretty} or ${dates[1].pretty}`;
  const last = dates[dates.length - 1];
  const head = dates.slice(0, -1).map((d) => d.pretty).join(", ");
  return `${head}, or ${last.pretty}`;
}
