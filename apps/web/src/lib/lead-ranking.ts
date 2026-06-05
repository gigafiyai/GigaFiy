// Shared outreach-priority ranking: how good a lead is to contact right now.
// Blends lead tier/score (how likely to book) with timing urgency (how soon
// the nearby confirmed show is). Used by the email recommendations, the call
// queue, and campaign ordering so all three rank identically.

export const TIER_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };

// Booking sweet spot is ~3-6 weeks out. Reward that window; penalize shows
// that already happened.
export function urgencyBonus(daysUntilShow: number | null): number {
  if (daysUntilShow === null) return 0;
  if (daysUntilShow < 0) return -50;   // show already passed — deprioritize hard
  if (daysUntilShow <= 14) return 10;  // very soon — tight but worth a shot
  if (daysUntilShow <= 45) return 25;  // ideal booking window
  if (daysUntilShow <= 90) return 15;  // a bit early but fine
  return 5;                            // far out — low urgency
}

// Composite outreach priority. Lead score is the spine (0-100); urgency nudges;
// a small tier kicker breaks ties so an A always edges a B at equal raw score.
export function outreachPriority(opts: {
  leadScore: number | null;
  leadTier: string | null;
  daysUntilShow: number | null;
}): number {
  const score = opts.leadScore ?? 0;
  const tier = TIER_RANK[opts.leadTier ?? "D"] ?? 1;
  return score + urgencyBonus(opts.daysUntilShow) + tier * 2;
}

const DAY_MS = 1000 * 60 * 60 * 24;

// Days from now until a show date (null if no date). Negative = already passed.
export function daysUntil(showDate: Date | null | undefined, now: number = Date.now()): number | null {
  if (!showDate) return null;
  return Math.round((showDate.getTime() - now) / DAY_MS);
}
