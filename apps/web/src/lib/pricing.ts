// Pricing recommendation engine.
// Suggests a fee range an independent artist should charge a given venue,
// based on venue type, capacity, day of week, live-music history, and the
// artist's typical draw. Pure heuristics — no external data. Over time this
// becomes a model trained on actual booked fees (the data moat again).

import type { VenueType } from "@gigify/db";

export type PriceInput = {
  venueType: VenueType;
  capacityEstimate: number | null;
  hostsLiveMusic: boolean | null;
  priceRange: string | null;       // "$" to "$$$$" from enrichment
  showDayOfWeek: string | null;    // "Friday", "Saturday", etc.
  isPrivateEvent?: boolean;        // owner / private booking
};

export type PriceRecommendation = {
  low: number;
  high: number;
  suggested: number;     // the number to anchor on
  depositSuggested: number; // 50%
  confidence: "high" | "medium" | "low";
  reasoning: string[];
  basedOn: "history" | "heuristic"; // did we use the artist's real fees?
};

// One of the artist's past gigs with a fee entered.
export type HistoricalGig = {
  showType: string;            // "festival" | "market" | "headline"
  fee: number;                 // what they charged / earned
  durationHours: number | null;
};

export type FeeHistory = {
  byShowType: Record<string, { avg: number; count: number }>;
  perHour: number | null;      // blended effective hourly rate
  sampleSize: number;
};

// Maps a discovered venue type to the closest show-type bucket the artist has
// historical fees for. (venueType taxonomy ≠ showType taxonomy.)
const VENUE_TO_SHOWTYPE: Record<VenueType, string> = {
  MUSIC_CLUB: "headline",
  ARTS_CENTER: "headline",
  BAR: "headline",
  RESTAURANT: "headline",
  FARMERS_MARKET: "market",
  FESTIVAL: "festival",
  OTHER: "headline",
};

// Builds the artist's fee history from their gigs that have a fee entered.
export function buildFeeHistory(gigs: HistoricalGig[]): FeeHistory {
  const byShowType: Record<string, { sum: number; count: number }> = {};
  let hourSum = 0;
  let hourCount = 0;

  for (const g of gigs) {
    if (!g.fee || g.fee <= 0) continue;
    const k = g.showType || "headline";
    (byShowType[k] ??= { sum: 0, count: 0 });
    byShowType[k].sum += g.fee;
    byShowType[k].count += 1;
    if (g.durationHours && g.durationHours > 0) {
      hourSum += g.fee / g.durationHours;
      hourCount += 1;
    }
  }

  const out: FeeHistory["byShowType"] = {};
  let total = 0;
  for (const [k, v] of Object.entries(byShowType)) {
    out[k] = { avg: Math.round(v.sum / v.count), count: v.count };
    total += v.count;
  }

  return {
    byShowType: out,
    perHour: hourCount > 0 ? Math.round(hourSum / hourCount) : null,
    sampleSize: total,
  };
}

// Base fee by venue type (solo/acoustic act, weeknight baseline in USD).
const BASE_BY_TYPE: Record<VenueType, number> = {
  MUSIC_CLUB: 350,
  ARTS_CENTER: 400,
  BAR: 250,
  RESTAURANT: 225,
  FARMERS_MARKET: 175,
  FESTIVAL: 300,
  OTHER: 200,
};

const WEEKEND = new Set(["Friday", "Saturday"]);
const PRIME = new Set(["Friday", "Saturday", "Sunday"]);

export function recommendPrice(
  input: PriceInput,
  history?: FeeHistory,
  estimatedHours?: number | null
): PriceRecommendation {
  const reasoning: string[] = [];

  // ── Prefer the artist's REAL historical fees when we have them. ──
  if (history && history.sampleSize >= 2) {
    const bucket = VENUE_TO_SHOWTYPE[input.venueType];
    const match = history.byShowType[bucket];

    // Direct match: artist has played this kind of gig before.
    if (match && match.count >= 1) {
      let suggested = match.avg;
      reasoning.push(`your avg for ${bucket} gigs: $${match.avg} (${match.count} past)`);
      // Day-of-week premium still applies on top of their baseline.
      if (input.showDayOfWeek && WEEKEND.has(input.showDayOfWeek)) {
        suggested = Math.round(suggested * 1.15);
        reasoning.push(`${input.showDayOfWeek} +15%`);
      }
      if (input.isPrivateEvent) {
        suggested = Math.round(suggested * 1.6);
        reasoning.push("private event +60%");
      }
      const s = Math.round(suggested / 25) * 25;
      return {
        low: Math.round((s * 0.85) / 25) * 25,
        high: Math.round((s * 1.25) / 25) * 25,
        suggested: s,
        depositSuggested: Math.round((s / 2) / 25) * 25,
        confidence: match.count >= 3 ? "high" : "medium",
        reasoning,
        basedOn: "history",
      };
    }

    // No exact bucket match, but we know their hourly rate.
    if (history.perHour && estimatedHours) {
      const s = Math.round((history.perHour * estimatedHours) / 25) * 25;
      reasoning.push(`your ~$${history.perHour}/hr × ${estimatedHours}h`);
      return {
        low: Math.round((s * 0.85) / 25) * 25,
        high: Math.round((s * 1.25) / 25) * 25,
        suggested: s,
        depositSuggested: Math.round((s / 2) / 25) * 25,
        confidence: "medium",
        reasoning,
        basedOn: "history",
      };
    }
  }

  // ── Fall back to heuristics when there's no usable history. ──
  let base = BASE_BY_TYPE[input.venueType] ?? 200;
  reasoning.push(`${input.venueType.replace("_", " ").toLowerCase()} baseline ~$${base}`);

  // Capacity multiplier — bigger rooms pay more.
  let capMult = 1;
  if (input.capacityEstimate != null) {
    if (input.capacityEstimate >= 300) { capMult = 1.6; reasoning.push("large room (300+ cap) +60%"); }
    else if (input.capacityEstimate >= 150) { capMult = 1.3; reasoning.push("mid room (150+ cap) +30%"); }
    else if (input.capacityEstimate >= 75) { capMult = 1.1; reasoning.push("small room (75+ cap) +10%"); }
    else if (input.capacityEstimate < 40) { capMult = 0.85; reasoning.push("intimate room (<40 cap) −15%"); }
  }

  // Day-of-week multiplier.
  let dayMult = 1;
  if (input.showDayOfWeek) {
    if (WEEKEND.has(input.showDayOfWeek)) { dayMult = 1.25; reasoning.push(`${input.showDayOfWeek} +25%`); }
    else if (PRIME.has(input.showDayOfWeek)) { dayMult = 1.1; reasoning.push(`${input.showDayOfWeek} +10%`); }
    else { reasoning.push(`${input.showDayOfWeek} (weeknight, no premium)`); }
  }

  // Venue affluence signal from enrichment price range.
  let affluenceMult = 1;
  if (input.priceRange === "$$$$" || input.priceRange === "VERY_EXPENSIVE") { affluenceMult = 1.4; reasoning.push("upscale venue ($$$$) +40%"); }
  else if (input.priceRange === "$$$" || input.priceRange === "EXPENSIVE") { affluenceMult = 1.2; reasoning.push("higher-end venue ($$$) +20%"); }
  else if (input.priceRange === "$" || input.priceRange === "INEXPENSIVE") { affluenceMult = 0.9; reasoning.push("budget venue ($) −10%"); }

  // Private events command a premium.
  let privateMult = 1;
  if (input.isPrivateEvent) { privateMult = 1.8; reasoning.push("private event +80%"); }

  const raw = base * capMult * dayMult * affluenceMult * privateMult;

  // Round to clean $25 increments.
  const suggested = Math.round(raw / 25) * 25;
  const low = Math.round((suggested * 0.8) / 25) * 25;
  const high = Math.round((suggested * 1.3) / 25) * 25;

  // Confidence: high when we have capacity + day + type; lower when missing data.
  const signals = [input.capacityEstimate != null, input.showDayOfWeek != null, input.hostsLiveMusic === true].filter(Boolean).length;
  const confidence: PriceRecommendation["confidence"] = signals >= 3 ? "high" : signals >= 1 ? "medium" : "low";

  return {
    low,
    high,
    suggested,
    depositSuggested: Math.round((suggested / 2) / 25) * 25,
    confidence,
    reasoning,
    basedOn: "heuristic",
  };
}

// Short one-liner for emails / UI: "$300–$450, anchor $350"
export function formatPriceRange(r: PriceRecommendation): string {
  return `$${r.low}–$${r.high} (anchor $${r.suggested})`;
}
