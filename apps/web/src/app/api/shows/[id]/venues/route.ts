import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Lazy-loaded venue list for a single show — powers the Dashboard's
// expandable per-show outreach rows. Sorted best-lead-first.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const venues = await prisma.venue.findMany({
    where: { nearestShowId: params.id, artistId: artist.id },
    include: {
      outreach: { orderBy: { createdAt: "desc" }, take: 1 },
      pipeline: true,
    },
  });

  const result = venues.map((v) => ({
    id: v.id,
    name: v.name,
    city: v.city,
    state: v.state,
    venueType: v.venueType,
    decisionMakerName: v.decisionMakerName,
    distanceMiles: v.distanceMiles,
    contactEmail: v.decisionMakerEmail ?? v.email,
    phone: v.phone,
    leadTier: v.leadTier,
    leadScore: v.leadScore,
    hostsLiveMusic: v.hostsLiveMusic,
    optedOut: v.optedOut,
    emailStatus: v.outreach[0]?.status ?? null,
    pipelineId: v.pipeline?.id ?? null,
    pipelineStage: v.pipeline?.stage ?? null,
  }));

  // Best leads first: lead score desc, then has-email, then distance.
  result.sort((a, b) => {
    if ((b.leadScore ?? 0) !== (a.leadScore ?? 0)) return (b.leadScore ?? 0) - (a.leadScore ?? 0);
    const ae = a.contactEmail ? 0 : 1;
    const be = b.contactEmail ? 0 : 1;
    if (ae !== be) return ae - be;
    return (a.distanceMiles ?? 999) - (b.distanceMiles ?? 999);
  });

  return NextResponse.json(result);
}
