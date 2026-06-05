import { describe, it, expect } from "vitest";
import { isWithinCallingHours } from "./calling-compliance";

// Pick a fixed UTC instant and check the derived local hour for a state.
// 2026-07-15 is summer → US DST active.
function at(utcHour: number): Date {
  return new Date(Date.UTC(2026, 6, 15, utcHour, 0, 0));
}

describe("isWithinCallingHours", () => {
  it("allows a mid-afternoon call on the East Coast", () => {
    // 18:00 UTC = 14:00 EDT (MA, summer) → inside 8am–9pm.
    const w = isWithinCallingHours("MA", at(18));
    expect(w.ok).toBe(true);
    expect(w.localHour).toBe(14);
  });

  it("blocks an early-morning call before 8am local", () => {
    // 10:00 UTC = 06:00 EDT → before 8am.
    const w = isWithinCallingHours("NY", at(10));
    expect(w.ok).toBe(false);
    expect(w.reason).toMatch(/calling hours/i);
  });

  it("blocks a late-night call after 9pm local", () => {
    // 03:00 UTC = 23:00 EDT previous evening → after 9pm.
    const w = isWithinCallingHours("MA", at(3));
    expect(w.ok).toBe(false);
  });

  it("accounts for Pacific offset", () => {
    // 18:00 UTC = 11:00 PDT (CA, summer).
    const w = isWithinCallingHours("CA", at(18));
    expect(w.localHour).toBe(11);
    expect(w.ok).toBe(true);
  });

  it("does not block when the state is unknown", () => {
    const w = isWithinCallingHours("ZZ", at(3));
    expect(w.ok).toBe(true);
    expect(w.localHour).toBeNull();
  });

  it("treats Arizona as no-DST (Mountain standard)", () => {
    // 18:00 UTC = 11:00 MST in AZ year-round (no DST).
    const w = isWithinCallingHours("AZ", at(18));
    expect(w.localHour).toBe(11);
  });
});
