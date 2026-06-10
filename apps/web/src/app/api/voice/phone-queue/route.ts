import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Returns venues with a phone number but no email — the manual-call queue.
// Sorted: nearest show first, then closest distance.
export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const venues = await prisma.venue.findMany({
    where: {
      artistId: artist.id,
      phone: { not: null },
      decisionMakerEmail: null,
      email: null,
    },
    include: {
      nearestShow: true,
      pipeline: true,
    },
    orderBy: { distanceMiles: "asc" },
  });

  const result = venues.map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    state: v.state,
    venueType: v.venueType,
    phone: v.phone,
    decisionMakerName: v.decisionMakerName,
    decisionMakerRole: v.decisionMakerRole,
    distanceMiles: v.distanceMiles,
    narrative: v.narrative,
    pipelineStage: v.pipeline?.stage ?? null,
    nearestShow: v.nearestShow
      ? {
          venueName: v.nearestShow.venueName,
          city: v.nearestShow.city,
          date: v.nearestShow.date.toISOString().slice(0, 10),
          distanceMiles: v.distanceMiles,
        }
      : null,
  }));

  // Sort by show date then distance.
  result.sort((a, b) => {
    const aDate = a.nearestShow?.date ?? "9999";
    const bDate = b.nearestShow?.date ?? "9999";
    if (aDate !== bDate) return aDate < bDate ? -1 : 1;
    return (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999);
  });

  return NextResponse.json(result);
}
