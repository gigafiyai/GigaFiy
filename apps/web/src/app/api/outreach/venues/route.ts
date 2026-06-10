import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Pull venues with their nearest show + latest outreach + pipeline.
  // The actual sort happens in JS below because Prisma can't sort by a
  // relation field's date + a computed "has email" boolean in one go.
  const rawVenues = await prisma.venue.findMany({
    where: { artistId: artist.id },
    include: {
      nearestShow: true,
      outreach: { orderBy: { createdAt: "desc" }, take: 1 },
      pipeline: true,
    },
  });

  // Chronological by show date, then has-email first, then closest distance.
  const venues = [...rawVenues].sort((a, b) => {
    const aDate = a.nearestShow?.date.getTime() ?? Infinity;
    const bDate = b.nearestShow?.date.getTime() ?? Infinity;
    if (aDate !== bDate) return aDate - bDate;

    const aHasEmail = !!(a.decisionMakerEmail ?? a.email);
    const bHasEmail = !!(b.decisionMakerEmail ?? b.email);
    if (aHasEmail !== bHasEmail) return aHasEmail ? -1 : 1;

    const aDist = a.distanceMiles ?? 9999;
    const bDist = b.distanceMiles ?? 9999;
    return aDist - bDist;
  });

  const result = venues.map((v) => {
    const latest = v.outreach[0] ?? null;
    // Quality score: venues likely to actually book live music rank higher.
    const qualityScore =
      (v.hostsLiveMusic === true ? 40 : 0) +
      (v.venueType === "MUSIC_CLUB" ? 30 : v.venueType === "BAR" ? 20 : v.venueType === "ARTS_CENTER" ? 15 : v.venueType === "RESTAURANT" ? 5 : 0) +
      (v.decisionMakerEmail || v.email ? 10 : 0);
    return {
      id: v.id,
      name: v.name,
      city: v.city,
      state: v.state,
      venueType: v.venueType,
      decisionMakerName: v.decisionMakerName,
      decisionMakerRole: v.decisionMakerRole,
      decisionMakerEmail: v.decisionMakerEmail,
      contactEmail: v.decisionMakerEmail ?? v.email,
      distanceMiles: v.distanceMiles,
      nearestShow: v.nearestShow
        ? {
            id: v.nearestShow.id,
            venueName: v.nearestShow.venueName,
            city: v.nearestShow.city,
            state: v.nearestShow.state,
            date: v.nearestShow.date.toISOString().slice(0, 10),
            dayOfWeek: v.nearestShow.dayOfWeek,
          }
        : null,
      latestOutreach: latest
        ? {
            status: latest.status,
            subjectLine: latest.subjectLine,
            sentAt: latest.sentAt?.toISOString() ?? null,
            openedAt: latest.openedAt?.toISOString() ?? null,
          }
        : null,
      pipelineStage: v.pipeline?.stage ?? null,
      hostsLiveMusic: v.hostsLiveMusic,
      qualityScore,
      leadScore: v.leadScore,
      leadTier: v.leadTier,
      leadReason: v.leadReason,
      phone: v.phone,
      isPhoneOnly: !!(v.phone && !v.decisionMakerEmail && !v.email),
    };
  });

  // Sort: CHRONOLOGICAL by show date first (the page groups by show, so groups
  // must appear in date order), then best leads first WITHIN each show.
  result.sort((a, b) => {
    const aDate = a.nearestShow?.date ?? "9999";
    const bDate = b.nearestShow?.date ?? "9999";
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    const aScore = (a as any).leadScore ?? a.qualityScore;
    const bScore = (b as any).leadScore ?? b.qualityScore;
    return bScore - aScore;
  });

  return NextResponse.json(result);
}
