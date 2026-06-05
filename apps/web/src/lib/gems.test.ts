import { describe, it, expect } from "vitest";
import { quoteCampaign, planCampaign, gemsPerItem, EMAIL_GEMS, CALL_GEMS } from "./gems";

describe("quoteCampaign", () => {
  it("prices an email campaign at 1 gem/venue", () => {
    const q = quoteCampaign(200, "email");
    expect(q.gemsPerItem).toBe(EMAIL_GEMS);
    expect(q.gemCost).toBe(200);
  });

  it("prices a call campaign much higher (the expensive channel)", () => {
    const q = quoteCampaign(50, "call");
    expect(q.gemsPerItem).toBe(CALL_GEMS);
    expect(q.gemCost).toBe(50 * CALL_GEMS);
    expect(q.gemCost).toBeGreaterThan(quoteCampaign(50, "email").gemCost);
  });

  it("calls cost ~20x an email", () => {
    expect(gemsPerItem("call") / gemsPerItem("email")).toBe(20);
  });
});

describe("planCampaign", () => {
  const ids = Array.from({ length: 55 }, (_, i) => `v${i}`);

  it("spreads venues across days respecting the per-day cap", () => {
    const { items, daysSpread } = planCampaign({
      rankedVenueIds: ids,
      perDayCap: 25,
      subdomains: ["a.com", "b.com"],
      startDate: new Date("2026-07-01T00:00:00Z"),
    });
    expect(items).toHaveLength(55);
    expect(daysSpread).toBe(3); // 25 + 25 + 5
    expect(items.filter((i) => i.dayOffset === 0)).toHaveLength(25);
    expect(items.filter((i) => i.dayOffset === 2)).toHaveLength(5);
  });

  it("preserves rank order (best-first) and is 1-indexed", () => {
    const { items } = planCampaign({
      rankedVenueIds: ["best", "mid", "worst"],
      perDayCap: 10,
      subdomains: [],
      startDate: new Date("2026-07-01T00:00:00Z"),
    });
    expect(items[0]).toMatchObject({ venueId: "best", rank: 1, dayOffset: 0 });
    expect(items[2]).toMatchObject({ venueId: "worst", rank: 3 });
  });

  it("rotates sending subdomains round-robin", () => {
    const { items } = planCampaign({
      rankedVenueIds: ["a", "b", "c", "d"],
      perDayCap: 10,
      subdomains: ["one.com", "two.com"],
      startDate: new Date("2026-07-01T00:00:00Z"),
    });
    expect(items.map((i) => i.sendingDomain)).toEqual(["one.com", "two.com", "one.com", "two.com"]);
  });

  it("assigns no domain for call campaigns", () => {
    const { items } = planCampaign({
      rankedVenueIds: ["a", "b"],
      perDayCap: 10,
      subdomains: [],
      startDate: new Date("2026-07-01T00:00:00Z"),
    });
    expect(items.every((i) => i.sendingDomain === null)).toBe(true);
  });
});
