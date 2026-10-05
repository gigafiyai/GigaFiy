import { describe, it, expect } from "vitest";
import { todayIso, startOfToday, daysFromToday } from "./today";

describe("today (US Eastern calendar day)", () => {
  it("is still the same day late in the Eastern evening, when UTC has rolled over", () => {
    // 9:30pm EDT on Oct 5 is 01:30 UTC on Oct 6.
    const lateEvening = new Date("2026-10-06T01:30:00Z");
    expect(todayIso(lateEvening)).toBe("2026-10-05");
    expect(startOfToday(lateEvening).toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });

  it("keeps tonight's show upcoming during the show", () => {
    const lateEvening = new Date("2026-10-06T01:30:00Z");
    const tonight = new Date("2026-10-05T00:00:00.000Z");
    expect(tonight >= startOfToday(lateEvening)).toBe(true);
    expect(daysFromToday(tonight, lateEvening)).toBe(0);
  });

  it("rolls over after Eastern midnight", () => {
    const afterMidnight = new Date("2026-10-06T04:30:00Z"); // 12:30am EDT Oct 6
    expect(todayIso(afterMidnight)).toBe("2026-10-06");
    expect(daysFromToday(new Date("2026-10-05T00:00:00.000Z"), afterMidnight)).toBe(-1);
  });

  it("counts days ahead", () => {
    const noon = new Date("2026-10-05T16:00:00Z");
    expect(daysFromToday(new Date("2026-10-06T00:00:00.000Z"), noon)).toBe(1);
    expect(daysFromToday(new Date("2026-10-25T00:00:00.000Z"), noon)).toBe(20);
  });
});
