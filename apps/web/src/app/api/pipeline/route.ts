import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import type { PipelineRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.pipeline.findMany({
    include: {
      venue: {
        include: {
          nearestShow: true,
          outreach: { orderBy: { createdAt: "desc" }, take: 1 },
          calls: { orderBy: { calledAt: "desc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const result: PipelineRow[] = rows.map((p) => {
    const venue = p.venue;
    const email = venue.outreach[0] ?? null;
    const call = venue.calls[0] ?? null;
    return {
      id: p.id,
      venueId: venue.id,
      venueName: venue.name,
      venueType: venue.venueType,
      city: venue.city,
      state: venue.state,
      decisionMakerName: venue.decisionMakerName,
      decisionMakerRole: venue.decisionMakerRole,
      decisionMakerEmail: venue.decisionMakerEmail,
      decisionMakerPhone: venue.decisionMakerPhone,
      venuePhone: venue.phone,
      venueEmail: venue.email,
      nearestShowDate: venue.nearestShow?.date.toISOString().slice(0, 10) ?? null,
      nearestShowName: venue.nearestShow?.venueName ?? null,
      nearestShowCity: venue.nearestShow?.city ?? null,
      distanceMiles: venue.distanceMiles,
      emailStatus: email?.status ?? null,
      emailOpenedAt: email?.openedAt?.toISOString() ?? null,
      callStatus: call?.status ?? null,
      stage: p.stage,
      depositAmount: p.depositAmount,
      depositPaidAt: p.depositPaidAt?.toISOString() ?? null,
      cancellationDeadline: p.cancellationDeadline?.toISOString() ?? null,
      bookedShowDate: p.bookedShowDate?.toISOString().slice(0, 10) ?? null,
      bookedShowFee: p.bookedShowFee,
      notes: p.notes,
      hostsLiveMusic: venue.hostsLiveMusic,
      narrative: venue.narrative,
      instagramHandle: venue.instagramHandle,
      vibe: venue.vibe,
      genresHosted: venue.genresHosted,
    };
  });

  return NextResponse.json(result);
}
