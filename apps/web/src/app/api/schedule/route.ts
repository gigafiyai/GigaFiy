import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const shows = await prisma.show.findMany({
    include: {
      nearbyVenues: {
        include: {
          outreach: { orderBy: { createdAt: "desc" }, take: 1 },
          pipeline: true,
        },
        orderBy: { distanceMiles: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  const result = shows.map((s) => {
    const venues = s.nearbyVenues.map((v) => ({
      id: v.id,
      name: v.name,
      city: v.city,
      state: v.state,
      venueType: v.venueType,
      decisionMakerName: v.decisionMakerName,
      decisionMakerRole: v.decisionMakerRole,
      distanceMiles: v.distanceMiles,
      emailStatus: v.outreach[0]?.status ?? null,
      pipelineStage: v.pipeline?.stage ?? null,
    }));
    const contacted = venues.filter((v) => v.pipelineStage && v.pipelineStage !== "QUEUED").length;
    return {
      id: s.id,
      date: s.date.toISOString().slice(0, 10),
      dayOfWeek: s.dayOfWeek,
      city: s.city,
      state: s.state,
      venueName: s.venueName,
      address: s.address,
      timeStart: s.timeStart?.toISOString() ?? null,
      timeEnd: s.timeEnd?.toISOString() ?? null,
      showType: s.showType,
      venueCount: venues.length,
      contactedCount: contacted,
      revenue: s.revenue,
      fee: s.fee,
      venues,
    };
  });

  return NextResponse.json(result);
}
