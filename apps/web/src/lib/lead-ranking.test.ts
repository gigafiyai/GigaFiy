import { describe, it, expect } from "vitest";
import { outreachPriority, urgencyBonus, daysUntil, TIER_RANK } from "./lead-ranking";

describe("urgencyBonus", () => {
  it("rewards the ideal booking window and penalizes past shows", () => {
    expect(urgencyBonus(30)).toBe(25); // 3-6 weeks out = sweet spot
    expect(urgencyBonus(-5)).toBe(-50); // already passed
    expect(urgencyBonus(null)).toBe(0);
    expect(urgencyBonus(200)).toBe(5); // far out
  });
});

describe("outreachPriority", () => {
  it("an A always edges a B at equal raw score (tier kicker)", () => {
    const a = outreachPriority({ leadScore: 60, leadTier: "A", daysUntilShow: 30 });
    const b = outreachPriority({ leadScore: 60, leadTier: "B", daysUntilShow: 30 });
    expect(a).toBeGreaterThan(b);
    expect(a - b).toBe((TIER_RANK.A - TIER_RANK.B) * 2);
  });

  it("a soon, high-score lead outranks a far, equal-score one", () => {
    const soon = outreachPriority({ leadScore: 70, leadTier: "B", daysUntilShow: 30 });
    const far = outreachPriority({ leadScore: 70, leadTier: "B", daysUntilShow: 200 });
    expect(soon).toBeGreaterThan(far);
  });

  it("treats nulls as the worst tier / no urgency", () => {
    expect(outreachPriority({ leadScore: null, leadTier: null, daysUntilShow: null })).toBe(TIER_RANK.D * 2);
  });
});

describe("daysUntil", () => {
  it("computes whole days from a fixed now", () => {
    const now = new Date("2026-07-01T00:00:00Z").getTime();
    expect(daysUntil(new Date("2026-07-11T00:00:00Z"), now)).toBe(10);
    expect(daysUntil(null, now)).toBeNull();
  });
});
