import { describe, it, expect, vi } from "vitest";

// The module talks to the database and Google; these tests only cover the pure helpers.
vi.mock("@gigify/db", () => ({ prisma: {} }));

import { nearestMiles, withinReach, parseDay } from "./venue-accounts";

const lakeville = { lat: 41.964, lng: -73.441 };
const hartford = { lat: 41.765, lng: -72.673 }; // ~42 mi from Lakeville
const boston = { lat: 42.36, lng: -71.058 }; // ~125 mi from Lakeville

describe("nearestMiles", () => {
  it("returns the closest show", () => {
    const d = nearestMiles(lakeville, [boston, hartford]);
    expect(d).toBeGreaterThan(35);
    expect(d).toBeLessThan(50);
  });
  it("is null when the act has no located shows", () => {
    expect(nearestMiles(lakeville, [])).toBeNull();
    expect(nearestMiles(lakeville, [{ lat: 0, lng: 0 }])).toBeNull();
  });
});

describe("withinReach", () => {
  const acts = [
    { name: "far", nearestMiles: 125 },
    { name: "unknown", nearestMiles: null },
    { name: "near", nearestMiles: 42 },
  ];
  it("drops acts beyond the radius, keeps unknowns, nearest first", () => {
    expect(withinReach(acts, 100).map((a) => a.name)).toEqual(["near", "unknown"]);
  });
  it("keeps everyone when there is no radius", () => {
    expect(withinReach(acts, null).map((a) => a.name)).toEqual(["near", "far", "unknown"]);
  });
});

describe("parseDay", () => {
  it("accepts YYYY-MM-DD only", () => {
    expect(parseDay("2026-10-09")?.toISOString()).toBe("2026-10-09T00:00:00.000Z");
    expect(parseDay("10/09/2026")).toBeNull();
    expect(parseDay("2026-13-40")).toBeNull();
    expect(parseDay(null)).toBeNull();
  });
});
