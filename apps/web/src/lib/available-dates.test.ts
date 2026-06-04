import { describe, it, expect } from "vitest";
import { computeAvailableDates, renderDateList, type AvailableDate } from "./available-dates";

// Anchor: Friday, July 17 2026 (no time data -> the anchor day itself is blocked).
const ANCHOR = { id: "anchor", date: new Date("2026-07-17T00:00:00Z") };

describe("computeAvailableDates", () => {
  it("suggests open days near the anchor without overlapping the anchor's own date", () => {
    const dates = computeAvailableDates({
      allShows: [ANCHOR],
      nearestShow: ANCHOR,
      venueType: "MUSIC_CLUB",
    });
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.length).toBeLessThanOrEqual(3);
    // None should be the anchor day (no intraday slot since it has no time data).
    expect(dates.every((d) => d.iso !== "2026-07-17")).toBe(true);
    // All within the +/-5 day window.
    for (const d of dates) {
      const diff = Math.abs(new Date(d.iso).getTime() - ANCHOR.date.getTime()) / 86_400_000;
      expect(diff).toBeLessThanOrEqual(5);
    }
  });

  it("offers a same-day evening slot when the anchor show ends early (double-book)", () => {
    const earlyShow = {
      id: "anchor",
      date: new Date("2026-07-17T00:00:00Z"),
      timeEnd: new Date("2026-07-17T16:00:00Z"), // wraps by 4pm UTC
      venueName: "Newton Porchfest",
    };
    const dates = computeAvailableDates({
      allShows: [earlyShow],
      nearestShow: earlyShow,
      venueType: "MUSIC_CLUB",
      count: 10,
    });
    const sameDay = dates.find((d) => d.iso === "2026-07-17");
    expect(sameDay).toBeDefined();
    expect(sameDay?.sameDayShowName).toBe("Newton Porchfest");
    expect(sameDay?.timeContext).toMatch(/evening/i);
  });

  it("never suggests a hard-blocked date", () => {
    const blockedIso = "2026-07-18";
    const dates = computeAvailableDates({
      allShows: [ANCHOR],
      nearestShow: ANCHOR,
      venueType: "MUSIC_CLUB",
      availabilityBlocks: [{ date: new Date(blockedIso + "T00:00:00Z"), type: "BLOCKED" }],
      count: 10,
    });
    expect(dates.every((d) => d.iso !== blockedIso)).toBe(true);
  });
});

describe("renderDateList", () => {
  const mk = (pretty: string): AvailableDate => ({ iso: "2026-07-20", pretty, isBefore: false, dayOfWeek: 1 });

  it("renders nothing for an empty list", () => {
    expect(renderDateList([])).toBe("");
  });
  it("renders a single date", () => {
    expect(renderDateList([mk("Monday, July 20")])).toBe("Monday, July 20");
  });
  it("joins two dates with 'or'", () => {
    expect(renderDateList([mk("Mon Jul 20"), mk("Wed Jul 22")])).toBe("Mon Jul 20 or Wed Jul 22");
  });
  it("uses an Oxford-style comma for three", () => {
    expect(renderDateList([mk("A"), mk("B"), mk("C")])).toBe("A, B, or C");
  });
});
