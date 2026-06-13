import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { outreachPriority, daysUntil } from "@/lib/lead-ranking";
import { getAuthedArtist } from "@/lib/tenant";
import { callBasis, isWarmOrBetter } from "@/lib/call-eligibility";

export const dynamic = "force-dynamic";

// The call queue: venues that have a PHONE number, ranked best-first, each
// tagged with its call basis (consented / warm / cold). Defaults to warm+
// (consented or engaged) so the safe, defensible leads surface first.
//
//   GET /api/calls/list?limit=50&uncalledOnly=true&warmOnly=true
export async function GET(req: NextRequest) {
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 50, 1), 200);
  const uncalledOnly = req.nextUrl.searchParams.get("uncalledOnly") === "true";
  const warmOnly = req.nextUrl.searchParams.get("warmOnly") === "true";

  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const venues = await prisma.venue.findMany({
    where: {
      artistId: artist.id,
      optedOut: false,
      phone: { not: null },
      ...(uncalledOnly ? { calls: { none: {} } } : {}),
    },
    include: {
      nearestShow: true,
      calls: { orderBy: { calledAt: "desc" }, take: 1 },
      pipeline: { select: { stage: true } },
      _count: { select: { replies: true } },
    },
  });

  const now = Date.now();

  let ranked = venues.map((v) => {
    const daysUntilShow = daysUntil(v.nearestShow?.date, now);
    const leadScore = v.leadScore ?? 0;
    const lastCall = v.calls[0] ?? null;
    const basis = callBasis({
      callConsent: v.callConsent,
      replied: v._count.replies > 0,
      pipelineStage: v.pipeline?.stage ?? null,
    });
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
      basis,
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
      callPriority: outreachPriority({ leadScore, leadTier: v.leadTier, daysUntilShow }),
    };
  });

  const warmCount = ranked.filter((v) => isWarmOrBetter(v.basis)).length;
  if (warmOnly) ranked = ranked.filter((v) => isWarmOrBetter(v.basis));

  ranked = ranked
    .sort((a, b) => b.callPriority - a.callPriority)
    .slice(0, limit)
    .map((v, i) => ({ rank: i + 1, ...v }));

  return NextResponse.json({ ok: true, count: ranked.length, warmCount, calls: ranked });
}
