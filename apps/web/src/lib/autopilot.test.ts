import { describe, it, expect } from "vitest";
import { pacePerTick, businessHoursLeft, WINDOW_START, WINDOW_END } from "./autopilot";

describe("pacePerTick", () => {
  it("spreads the remaining budget evenly across remaining hours", () => {
    // 20 items, 10 hours left → 2/hour.
    expect(pacePerTick(20, 10)).toBe(2);
    // 21 items, 10 hours → ceil(2.1) = 3 (slightly front-loaded, self-corrects).
    expect(pacePerTick(21, 10)).toBe(3);
  });

  it("does everything left in the final hour", () => {
    expect(pacePerTick(7, 1)).toBe(7);
    expect(pacePerTick(7, 0)).toBe(7);
  });

  it("returns 0 when nothing is left", () => {
    expect(pacePerTick(0, 5)).toBe(0);
  });
});

describe("businessHoursLeft", () => {
  function at(hour: number): Date {
    const d = new Date();
    d.setHours(hour, 0, 0, 0);
    return d;
  }

  it("is the full window before it opens", () => {
    expect(businessHoursLeft(at(6))).toBe(WINDOW_END - WINDOW_START);
  });

  it("counts down within the window", () => {
    expect(businessHoursLeft(at(14))).toBe(WINDOW_END - 14);
  });

  it("is zero after the window closes", () => {
    expect(businessHoursLeft(at(22))).toBe(0);
  });
});
