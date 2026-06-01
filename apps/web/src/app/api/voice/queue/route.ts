import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { variantForRole } from "@/lib/call-scripts";

export const dynamic = "force-dynamic";

// Returns venues ready for a call: pipeline stage in (EMAILED, INTERESTED, CALLED-no-answer).
// Sorted by email-opened first, then by nearest show distance.
export async function GET() {
  const pipelines = await prisma.pipeline.findMany({
    where: { stage: { in: ["EMAILED", "INTERESTED", "CALLED"] } },
    include: {
      venue: {
        include: {
          nearestShow: true,
          outreach: { orderBy: { createdAt: "desc" }, take: 1 },
          calls: { orderBy: { calledAt: "desc" }, take: 1 },
        },
      },
      artist: true,
    },
  });

  const result = pipelines.map((p) => {
    const v = p.venue;
    const email = v.outreach[0] ?? null;
    const lastCall = v.calls[0] ?? null;
    return {
      pipelineId: p.id,
      venueId: v.id,
      venueName: v.name,
      city: v.city,
      state: v.state,
      venueType: v.venueType,
      decisionMakerName: v.decisionMakerName,
      decisionMakerRole: v.decisionMakerRole,
      decisionMakerPhone: v.decisionMakerPhone ?? v.phone,
      scriptVariant: variantForRole(v.decisionMakerRole),
      stage: p.stage,
      emailOpened: email?.openedAt != null,
      emailStatus: email?.status ?? null,
      lastCallStatus: lastCall?.status ?? null,
      lastCalledAt: lastCall?.calledAt?.toISOString() ?? null,
      nearestShow: v.nearestShow
        ? {
            venueName: v.nearestShow.venueName,
            city: v.nearestShow.city,
            date: v.nearestShow.date.toISOString().slice(0, 10),
            distanceMiles: v.distanceMiles ?? 0,
          }
        : null,
      artistName: p.artist.name,
      artistGenre: p.artist.genre,
    };
  });

  // email-opened first, then closest show
  result.sort((a, b) => {
    if (a.emailOpened !== b.emailOpened) return a.emailOpened ? -1 : 1;
    const aDist = a.nearestShow?.distanceMiles ?? 9999;
    const bDist = b.nearestShow?.distanceMiles ?? 9999;
    return aDist - bDist;
  });

  return NextResponse.json(result);
}
