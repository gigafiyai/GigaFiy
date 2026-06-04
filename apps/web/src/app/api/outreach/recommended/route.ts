import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getSendBudget } from "@/lib/send-throttle";

export const dynamic = "force-dynamic";

// The "who should we email next" list.
//
// Ranks reachable, still-queued venues by a blend of:
//   1. Lead tier / score (A > B > C > D) — how likely they are to book.
//   2. Urgency — how soon the nearby confirmed show is. Outreach is
//      time-sensitive: a venue near a show 3 weeks out matters more than one
//      near a show 4 months out, and a show already in the past is near-dead.
//
// Returns a ranked 1..N list (default 50). The UI shows the whole ranked list
// but only the top `budget.remaining` are sendable today under the daily cap.

const TIER_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };

// Booking sweet spot for an indie act is ~3-6 weeks out. Reward shows in that
// window; penalize ones that already happened.
function urgencyBonus(daysUntilShow: number | null): number {
  if (daysUntilShow === null) return 0;
  if (daysUntilShow < 0) return -50;      // show already passed — deprioritize hard
  if (daysUntilShow <= 14) return 10;      // very soon — tight but worth a shot
  if (daysUntilShow <= 45) return 25;      // ideal booking window
  if (daysUntilShow <= 90) return 15;      // a bit early but fine
  return 5;                                 // far out — low urgency
}

export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 50, 1), 200);

  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  // Candidates: queued, not opted out, reachable by email.
  const venues = await prisma.venue.findMany({
    where: {
      optedOut: false,
      pipeline: { stage: "QUEUED" },
      OR: [{ decisionMakerEmail: { not: null } }, { email: { not: null } }],
    },
    include: { nearestShow: true },
  });

  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;

  const ranked = venues
    .map((v) => {
      const showDate = v.nearestShow?.date ?? null;
      const daysUntilShow = showDate ? Math.round((showDate.getTime() - now) / DAY) : null;
      const leadScore = v.leadScore ?? 0;
      const tierRank = TIER_RANK[v.leadTier ?? "D"] ?? 1;
      // Composite: lead score is the spine (0-100), urgency nudges, and we add a
      // small tier kicker so an A always edges a B at equal raw score.
      const recommendationScore = leadScore + urgencyBonus(daysUntilShow) + tierRank * 2;
      return {
        id: v.id,
        name: v.name,
        city: v.city,
        state: v.state,
        venueType: v.venueType,
        contactEmail: v.decisionMakerEmail ?? v.email,
        decisionMakerName: v.decisionMakerName,
        distanceMiles: v.distanceMiles,
        leadScore,
        leadTier: v.leadTier,
        leadReason: v.leadReason,
        nearestShow: v.nearestShow
          ? {
              id: v.nearestShow.id,
              venueName: v.nearestShow.venueName,
              city: v.nearestShow.city,
              state: v.nearestShow.state,
              date: v.nearestShow.date.toISOString().slice(0, 10),
            }
          : null,
        daysUntilShow,
        recommendationScore,
      };
    })
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, limit)
    .map((v, i) => ({ rank: i + 1, ...v }));

  const budget = await getSendBudget(artist.id, artist.plan);

  return NextResponse.json({
    ok: true,
    budget, // { plan, cap, sentToday, remaining }
    count: ranked.length,
    // The top `remaining` of this list are the ones to actually send today.
    sendableToday: ranked.slice(0, budget.remaining).map((v) => v.id),
    recommendations: ranked,
  });
}
