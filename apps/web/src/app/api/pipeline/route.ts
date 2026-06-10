import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import type { PipelineRow } from "@/lib/types";
import { recommendPrice, buildFeeHistory, type HistoricalGig } from "@/lib/pricing";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  // Build the artist's real fee history from gigs that have a fee/revenue entered.
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const pastGigs = artist
    ? await prisma.show.findMany({
        where: { artistId: artist.id, OR: [{ fee: { not: null } }, { revenue: { not: null } }] },
        select: { showType: true, fee: true, revenue: true, timeStart: true, timeEnd: true },
      })
    : [];
  const feeHistory = buildFeeHistory(
    pastGigs.map<HistoricalGig>((g) => ({
      showType: g.showType,
      fee: g.fee ?? g.revenue ?? 0,
      durationHours:
        g.timeStart && g.timeEnd
          ? (g.timeEnd.getTime() - g.timeStart.getTime()) / 3600000
          : null,
    }))
  );

  const rows = await prisma.pipeline.findMany({
    where: { artistId: artist.id },
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
    const price = recommendPrice(
      {
        venueType: venue.venueType,
        capacityEstimate: venue.capacityEstimate,
        hostsLiveMusic: venue.hostsLiveMusic,
        priceRange: venue.priceRange,
        showDayOfWeek: venue.nearestShow?.dayOfWeek ?? null,
      },
      feeHistory,
      2 // default 2-hour set estimate for the per-hour fallback
    );
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
      suggestedFeeLow: price.low,
      suggestedFeeHigh: price.high,
      suggestedFee: price.suggested,
      suggestedDeposit: price.depositSuggested,
      priceConfidence: price.confidence,
      priceReasoning: price.reasoning,
      priceBasedOn: price.basedOn,
    };
  });

  return NextResponse.json(result);
}
