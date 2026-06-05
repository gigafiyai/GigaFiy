import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getSendBudget } from "@/lib/send-throttle";
import { outreachPriority, daysUntil } from "@/lib/lead-ranking";

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

  const ranked = venues
    .map((v) => {
      const daysUntilShow = daysUntil(v.nearestShow?.date, now);
      const leadScore = v.leadScore ?? 0;
      const recommendationScore = outreachPriority({ leadScore, leadTier: v.leadTier, daysUntilShow });
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
