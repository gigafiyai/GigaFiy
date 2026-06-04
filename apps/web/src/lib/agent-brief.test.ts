import { describe, it, expect } from "vitest";
import { buildAgentBrief, type AgentBriefInput } from "./agent-brief";

function input(overrides: Partial<AgentBriefInput> = {}): AgentBriefInput {
  return {
    agentName: "Tulio",
    artist: {
      name: "Elijah Stone",
      genre: "Indie Folk",
      bio: "Singer-songwriter with a roots-folk sound.",
      hometown: "Burlington, VT",
      drawDescription: "80-150 weeknights",
      soundsLike: null,
      audienceProfile: null,
      performanceStyle: null,
      accolades: null,
      spotifyUrl: null,
      videoReelUrl: null,
      instagramHandle: null,
    },
    venue: {
      name: "Club Passim",
      city: "Cambridge",
      state: "MA",
      venueType: "MUSIC_CLUB",
      decisionMakerName: "Sarah Chen",
      decisionMakerRole: "Talent Buyer",
      narrative: null,
      hostsLiveMusic: true,
      genresHosted: ["folk"],
      vibe: ["listening room"],
      pastArtists: [],
    },
    nearestShow: {
      venueName: "The Sinclair",
      city: "Cambridge",
      state: "MA",
      date: "2026-07-17",
      distanceMiles: 4,
    },
    nearestShowDaysOut: 30,
    futureNearbyShows: [],
    pastShows: [],
    upcomingShows: [],
    suggestedDates: [],
    recommendedFee: 450,
    depositPercent: 50,
    bookingLink: "https://gigify.app/elijah-stone?ref=v123",
    ...overrides,
  };
}

describe("buildAgentBrief", () => {
  it("produces a persona, opener, and voicemail naming the agent + artist", () => {
    const b = buildAgentBrief(input());
    expect(b.agentName).toBe("Tulio");
    expect(b.systemPrompt).toContain("Tulio");
    expect(b.systemPrompt).toContain("Elijah Stone");
    expect(b.firstLine).toContain("Tulio");
    expect(b.voicemail).toContain("Elijah Stone");
  });

  it("includes the anti-fabrication guardrail and the booking link", () => {
    const b = buildAgentBrief(input());
    expect(b.systemPrompt).toMatch(/NEVER invent facts/i);
    expect(b.knowledge.theOffer.join(" ")).toContain("https://gigify.app/elijah-stone?ref=v123");
  });

  it("never leaks null/undefined when optional fields are missing", () => {
    const b = buildAgentBrief(input());
    expect(b.systemPrompt).not.toContain("null");
    expect(b.systemPrompt).not.toContain("undefined");
  });

  it("treats a show within 14 days as short notice", () => {
    const b = buildAgentBrief(input({ nearestShowDaysOut: 9 }));
    expect(b.systemPrompt).toMatch(/short notice/i);
  });

  it("treats a far-out show as comfortable lead time", () => {
    const b = buildAgentBrief(input({ nearestShowDaysOut: 120 }));
    expect(b.systemPrompt).toMatch(/plenty of lead time/i);
  });

  it("flags a same-day double-book opportunity in the date list", () => {
    const b = buildAgentBrief(
      input({
        suggestedDates: [{ pretty: "Friday, July 17", timeContext: "evening, after 9 PM", sameDayShowName: "Newton Porchfest" }],
      })
    );
    expect(b.systemPrompt).toContain("SAME DAY");
    expect(b.systemPrompt).toContain("Newton Porchfest");
  });

  it("offers future nearby passes when provided", () => {
    const b = buildAgentBrief(
      input({
        nearestShowDaysOut: 8,
        futureNearbyShows: [
          { venueName: "Stone Church", city: "Newmarket", state: "NH", date: "2026-09-12", prettyDate: "Saturday, September 12", distanceMiles: 22 },
        ],
      })
    );
    expect(b.systemPrompt).toContain("Stone Church");
  });
});
