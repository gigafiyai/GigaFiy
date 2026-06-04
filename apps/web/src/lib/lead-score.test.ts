import { describe, it, expect } from "vitest";
import { scoreVenue, type ScoredVenueInput } from "./lead-score";

function base(overrides: Partial<ScoredVenueInput> = {}): ScoredVenueInput {
  return {
    name: "The Sinclair",
    venueType: "MUSIC_CLUB",
    hostsLiveMusic: null,
    genresHosted: [],
    vibe: [],
    distanceMiles: null,
    hasEmail: false,
    hasPhone: false,
    hasNarrative: false,
    hasDecisionMakerName: false,
    artistGenre: "Indie Folk",
    ...overrides,
  };
}

describe("scoreVenue", () => {
  it("caps obvious non-booking venues at D regardless of type", () => {
    const r = scoreVenue(base({ name: "State Correctional Facility", venueType: "MUSIC_CLUB", hostsLiveMusic: true }));
    expect(r.tier).toBe("D");
    expect(r.total).toBe(10);
    expect(r.reason).toMatch(/not a booking venue/i);
  });

  it("scores a strong live-music club as A tier", () => {
    const r = scoreVenue(
      base({
        venueType: "MUSIC_CLUB",
        hostsLiveMusic: true,
        genresHosted: ["folk", "americana"],
        distanceMiles: 3,
        hasEmail: true,
        hasDecisionMakerName: true,
      })
    );
    expect(r.tier).toBe("A");
    expect(r.total).toBeGreaterThanOrEqual(75);
    expect(r.breakdown.hosts_live_music).toBe(30);
    expect(r.breakdown.genre_match).toBe(25);
  });

  it("matches genre via synonyms (folk ~ americana/acoustic)", () => {
    const matched = scoreVenue(base({ genresHosted: ["Acoustic Sessions"], artistGenre: "folk" }));
    expect(matched.breakdown.genre_match).toBe(25);
    const unmatched = scoreVenue(base({ genresHosted: ["techno"], artistGenre: "folk" }));
    expect(unmatched.breakdown.genre_match).toBeUndefined();
  });

  it("penalizes venues that explicitly do not host live music", () => {
    const r = scoreVenue(base({ venueType: "RESTAURANT", hostsLiveMusic: false }));
    expect(r.breakdown.no_live_music).toBe(-20);
    expect(r.tier).toBe("D");
  });

  it("rewards proximity within 5 miles", () => {
    const close = scoreVenue(base({ distanceMiles: 4 }));
    const far = scoreVenue(base({ distanceMiles: 40 }));
    expect(close.breakdown.proximity).toBe(20);
    expect(far.breakdown.proximity).toBe(5);
  });

  it("clamps total to 0..100", () => {
    const r = scoreVenue(
      base({
        venueType: "MUSIC_CLUB",
        hostsLiveMusic: true,
        genresHosted: ["folk"],
        vibe: ["intimate", "listening room"],
        distanceMiles: 1,
        hasEmail: true,
        hasDecisionMakerName: true,
        hasNarrative: true,
      })
    );
    expect(r.total).toBeLessThanOrEqual(100);
    expect(r.total).toBeGreaterThanOrEqual(0);
  });
});
