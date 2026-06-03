import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { scoreVenue } from "@/lib/lead-score";

export const dynamic = "force-dynamic";

// Scores all venues and writes leadScore + leadTier to the DB.
// Run after enrichment completes to re-prioritize the outreach queue.
export async function POST() {
  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const venues = await prisma.venue.findMany({
    select: {
      id: true, name: true, venueType: true, hostsLiveMusic: true,
      genresHosted: true, vibe: true, distanceMiles: true,
      decisionMakerEmail: true, email: true,
      phone: true, narrative: true, decisionMakerName: true,
    },
  });

  let scored = 0;
  for (const v of venues) {
    const result = scoreVenue({
      name: v.name,
      venueType: v.venueType,
      hostsLiveMusic: v.hostsLiveMusic,
      genresHosted: v.genresHosted,
      vibe: v.vibe,
      distanceMiles: v.distanceMiles,
      hasEmail: !!(v.decisionMakerEmail || v.email),
      hasPhone: !!v.phone,
      hasNarrative: !!v.narrative,
      hasDecisionMakerName: !!v.decisionMakerName,
      artistGenre: artist.genre,
    });

    await prisma.venue.update({
      where: { id: v.id },
      data: {
        leadScore: result.total,
        leadTier: result.tier,
        leadReason: result.reason,
      },
    });
    scored++;
  }

  const tiers = await prisma.venue.groupBy({
    by: ["leadTier"],
    _count: true,
    orderBy: { leadTier: "asc" },
  });

  return NextResponse.json({ ok: true, scored, tiers });
}
