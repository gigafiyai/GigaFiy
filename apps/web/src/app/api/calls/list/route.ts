import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// The call queue: venues that have a PHONE number, ranked best-first.
// Phone is the channel that can't be spam-foldered or throttled, so this is the
// premium "have Tulio call your best leads" list. Ranked by lead tier/score +
// proximity-to-show urgency, same spirit as the email recommendations.
//
//   GET /api/calls/list?limit=50&uncalledOnly=true
const TIER_RANK: Record<string, number> = { A: 4, B: 3, C: 2, D: 1 };

function urgencyBonus(daysUntilShow: number | null): number {
  if (daysUntilShow === null) return 0;
  if (daysUntilShow < 0) return -50;
  if (daysUntilShow <= 14) return 10;
  if (daysUntilShow <= 45) return 25;
  if (daysUntilShow <= 90) return 15;
  return 5;
}

export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 50, 1), 200);
  const uncalledOnly = req.nextUrl.searchParams.get("uncalledOnly") === "true";

  const venues = await prisma.venue.findMany({
    where: {
      optedOut: false,
      phone: { not: null },
      ...(uncalledOnly ? { calls: { none: {} } } : {}),
    },
    include: {
      nearestShow: true,
      calls: { orderBy: { calledAt: "desc" }, take: 1 },
    },
  });

  const now = Date.now();
  const DAY = 1000 * 60 * 60 * 24;

  const ranked = venues
    .map((v) => {
      const showDate = v.nearestShow?.date ?? null;
      const daysUntilShow = showDate ? Math.round((showDate.getTime() - now) / DAY) : null;
      const leadScore = v.leadScore ?? 0;
      const tierRank = TIER_RANK[v.leadTier ?? "D"] ?? 1;
      const lastCall = v.calls[0] ?? null;
      return {
        id: v.id,
        name: v.name,
        city: v.city,
        state: v.state,
        venueType: v.venueType,
        phone: v.phone,
        decisionMakerName: v.decisionMakerName,
        decisionMakerRole: v.decisionMakerRole,
        leadScore,
        leadTier: v.leadTier,
        leadReason: v.leadReason,
        hasEmail: !!(v.decisionMakerEmail ?? v.email),
        nearestShow: v.nearestShow
          ? {
              venueName: v.nearestShow.venueName,
              city: v.nearestShow.city,
              state: v.nearestShow.state,
              date: v.nearestShow.date.toISOString().slice(0, 10),
            }
          : null,
        daysUntilShow,
        lastCall: lastCall
          ? { status: lastCall.status, callTier: lastCall.callTier, calledAt: lastCall.calledAt?.toISOString() ?? null }
          : null,
        callPriority: leadScore + urgencyBonus(daysUntilShow) + tierRank * 2,
      };
    })
    .sort((a, b) => b.callPriority - a.callPriority)
    .slice(0, limit)
    .map((v, i) => ({ rank: i + 1, ...v }));

  return NextResponse.json({ ok: true, count: ranked.length, calls: ranked });
}
