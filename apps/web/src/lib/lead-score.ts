// Lead scoring for venue outreach prioritization.
// Higher score = more likely to book. Used to sort the outreach queue
// and surface the best targets first.

import type { VenueType } from "@gigify/db";

export type ScoredVenueInput = {
  venueType: VenueType;
  hostsLiveMusic: boolean | null;
  genresHosted: string[];
  vibe: string[];
  distanceMiles: number | null;
  hasEmail: boolean;
  hasPhone: boolean;
  hasNarrative: boolean;
  hasDecisionMakerName: boolean;
  artistGenre: string;
};

export type LeadScore = {
  total: number;
  breakdown: Record<string, number>;
  tier: "A" | "B" | "C" | "D";
  reason: string; // e.g. "Live music confirmed · Folk genre match · Close to show"
};

const GENRE_SYNONYMS: Record<string, string[]> = {
  folk: ["folk", "americana", "acoustic", "roots", "country", "bluegrass", "singer-songwriter"],
  jazz: ["jazz", "blues", "soul", "swing"],
  rock: ["rock", "indie", "alternative", "punk"],
  pop: ["pop", "top 40", "dance"],
  classical: ["classical", "orchestral", "chamber"],
  electronic: ["electronic", "dj", "techno", "house"],
};

function genreOverlap(artistGenre: string, venueGenres: string[]): boolean {
  if (venueGenres.length === 0) return false;
  const lc = artistGenre.toLowerCase();
  const synonymGroup = Object.entries(GENRE_SYNONYMS).find(([, syns]) =>
    syns.some((s) => lc.includes(s))
  );
  if (!synonymGroup) return false;
  const [, syns] = synonymGroup;
  return venueGenres.some((g) => syns.some((s) => g.toLowerCase().includes(s)));
}

const LISTENING_ROOM_VIBES = ["intimate", "listening room", "quiet", "acoustic", "cozy", "unplugged"];

export function scoreVenue(v: ScoredVenueInput): LeadScore {
  const breakdown: Record<string, number> = {};
  const reasons: string[] = [];

  // ── Venue type (base signal) ──
  const typeScore =
    v.venueType === "MUSIC_CLUB" ? 35 :
    v.venueType === "BAR" ? 25 :
    v.venueType === "ARTS_CENTER" ? 20 :
    v.venueType === "RESTAURANT" ? 10 :
    v.venueType === "FARMERS_MARKET" || v.venueType === "FESTIVAL" ? 15 : 5;
  breakdown["venue_type"] = typeScore;

  // ── Live music confirmed ──
  if (v.hostsLiveMusic === true) {
    breakdown["hosts_live_music"] = 30;
    reasons.push("hosts live music");
  } else if (v.hostsLiveMusic === false) {
    breakdown["no_live_music"] = -20;
  }

  // ── Genre match ──
  if (genreOverlap(v.artistGenre, v.genresHosted)) {
    breakdown["genre_match"] = 25;
    reasons.push("genre match");
  }

  // ── Listening room vibe ──
  if (v.vibe.some((vb) => LISTENING_ROOM_VIBES.some((lv) => vb.toLowerCase().includes(lv)))) {
    breakdown["listening_room"] = 15;
    reasons.push("listening room vibe");
  }

  // ── Proximity ──
  if (v.distanceMiles !== null) {
    const distScore =
      v.distanceMiles <= 5 ? 20 :
      v.distanceMiles <= 15 ? 15 :
      v.distanceMiles <= 25 ? 10 : 5;
    breakdown["proximity"] = distScore;
    if (v.distanceMiles <= 5) reasons.push("< 5 mi from show");
  }

  // ── Contact quality ──
  if (v.hasEmail) breakdown["has_email"] = 10;
  if (v.hasDecisionMakerName) { breakdown["has_contact_name"] = 8; reasons.push("named contact"); }
  if (v.hasPhone && !v.hasEmail) breakdown["phone_only"] = 3; // partial credit

  // ── Intelligence depth ──
  if (v.hasNarrative) breakdown["has_narrative"] = 5; // scraped — email can be more personal

  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  const clamped = Math.max(0, Math.min(100, total));

  const tier: LeadScore["tier"] =
    clamped >= 75 ? "A" : clamped >= 55 ? "B" : clamped >= 35 ? "C" : "D";

  if (typeScore >= 25 && !reasons.includes("hosts live music")) {
    reasons.unshift(v.venueType.replace("_", " ").toLowerCase());
  }

  return {
    total: clamped,
    breakdown,
    tier,
    reason: reasons.slice(0, 3).join(" · ") || v.venueType.replace("_", " ").toLowerCase(),
  };
}
