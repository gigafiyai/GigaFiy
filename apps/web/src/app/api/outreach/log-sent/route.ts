import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Records an email the artist sent from their OWN inbox (we generated the draft;
// they sent it). Logs an Outreach row + advances the pipeline — no email is
// sent by Gigify.
export async function POST(req: NextRequest) {
  const { venueId, subject, body } = (await req.json()) as { venueId?: string; subject?: string; body?: string };
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const venue = await prisma.venue.findFirst({ where: { id: venueId, artistId: artist.id }, include: { pipeline: true } });
  if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  await prisma.outreach.create({
    data: {
      venueId: venue.id,
      artistId: artist.id,
      channel: "EMAIL",
      status: "SENT",
      subjectLine: subject ?? null,
      body: body ?? null,
      sentAt: new Date(),
      variant: "manual",
    },
  });

  if (venue.pipeline && venue.pipeline.stage === "QUEUED") {
    await prisma.pipeline.update({ where: { id: venue.pipeline.id }, data: { stage: "EMAILED" } });
  }

  return NextResponse.json({ ok: true });
}
