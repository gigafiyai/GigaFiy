import { describe, it, expect } from "vitest";
import { buildFeeHistory, recommendPrice, formatPriceRange, type HistoricalGig } from "./pricing";

describe("buildFeeHistory", () => {
  it("averages fees per show type and computes a blended hourly rate", () => {
    const gigs: HistoricalGig[] = [
      { showType: "headline", fee: 400, durationHours: 2 },
      { showType: "headline", fee: 600, durationHours: 3 },
      { showType: "festival", fee: 1000, durationHours: null },
    ];
    const h = buildFeeHistory(gigs);
    expect(h.byShowType.headline).toEqual({ avg: 500, count: 2 });
    expect(h.byShowType.festival).toEqual({ avg: 1000, count: 1 });
    expect(h.sampleSize).toBe(3);
    expect(h.perHour).toBe(200); // (400/2 + 600/3) / 2
  });

  it("ignores zero/negative fees", () => {
    const h = buildFeeHistory([
      { showType: "headline", fee: 0, durationHours: 2 },
      { showType: "headline", fee: -100, durationHours: 1 },
    ]);
    expect(h.sampleSize).toBe(0);
    expect(h.perHour).toBeNull();
  });
});

describe("recommendPrice", () => {
  it("prefers the artist's real history when sample is sufficient", () => {
    const history = buildFeeHistory([
      { showType: "headline", fee: 400, durationHours: 2 },
      { showType: "headline", fee: 600, durationHours: 3 },
    ]);
    const r = recommendPrice(
      { venueType: "MUSIC_CLUB", capacityEstimate: null, hostsLiveMusic: true, priceRange: null, showDayOfWeek: "Tuesday" },
      history
    );
    expect(r.basedOn).toBe("history");
    expect(r.suggested).toBe(500);
    expect(r.depositSuggested).toBe(250);
  });

  it("applies a weekend premium on top of historical baseline", () => {
    const history = buildFeeHistory([
      { showType: "headline", fee: 500, durationHours: 2 },
      { showType: "headline", fee: 500, durationHours: 2 },
    ]);
    const r = recommendPrice(
      { venueType: "MUSIC_CLUB", capacityEstimate: null, hostsLiveMusic: true, priceRange: null, showDayOfWeek: "Saturday" },
      history
    );
    expect(r.suggested).toBeGreaterThan(500); // +15%
  });

  it("falls back to heuristics with no usable history", () => {
    const r = recommendPrice({
      venueType: "MUSIC_CLUB",
      capacityEstimate: null,
      hostsLiveMusic: true,
      priceRange: null,
      showDayOfWeek: "Tuesday",
    });
    expect(r.basedOn).toBe("heuristic");
    expect(r.suggested).toBe(350); // MUSIC_CLUB weeknight baseline
  });

  it("rounds to clean $25 increments", () => {
    const r = recommendPrice({
      venueType: "BAR",
      capacityEstimate: 200,
      hostsLiveMusic: true,
      priceRange: "$$$",
      showDayOfWeek: "Saturday",
    });
    expect(r.suggested % 25).toBe(0);
    expect(r.low % 25).toBe(0);
    expect(r.high % 25).toBe(0);
  });

  it("formats a readable price range", () => {
    const r = recommendPrice({
      venueType: "MUSIC_CLUB", capacityEstimate: null, hostsLiveMusic: true, priceRange: null, showDayOfWeek: "Tuesday",
    });
    expect(formatPriceRange(r)).toBe(`$${r.low}–$${r.high} (anchor $${r.suggested})`);
  });
});
