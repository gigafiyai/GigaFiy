import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { isExcludedVenue } from "@/lib/discovery";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Deletes venues whose name matches the current discovery blocklist (chains,
// fast food, casinos, etc.) along with their dependent Outreach / Call /
// Pipeline / Survey rows. Run after extending the blocklist.
export async function POST() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const venues = await prisma.venue.findMany({
    where: { artistId: artist.id },
    select: { id: true, name: true },
  });

  const doomed = venues.filter((v) => isExcludedVenue(v.name));
  const doomedIds = doomed.map((v) => v.id);

  if (doomedIds.length === 0) {
    return NextResponse.json({ ok: true, removed: 0, names: [] });
  }

  await prisma.$transaction(async (tx) => {
    // Surveys → pipeline → calls → outreach → venue.
    await tx.survey.deleteMany({ where: { venueId: { in: doomedIds } } });
    await tx.pipeline.deleteMany({ where: { venueId: { in: doomedIds } } });
    await tx.call.deleteMany({ where: { venueId: { in: doomedIds } } });
    await tx.outreach.deleteMany({ where: { venueId: { in: doomedIds } } });
    await tx.venue.deleteMany({ where: { id: { in: doomedIds } } });
  });

  return NextResponse.json({
    ok: true,
    removed: doomedIds.length,
    names: doomed.map((v) => v.name).sort(),
  });
}
