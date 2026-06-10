import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

async function getPilotArtist() {
  return getAuthedArtist();
}

export async function GET() {
  const artist = await getPilotArtist();
  if (!artist) return NextResponse.json([]);

  const blocks = await prisma.artistAvailability.findMany({
    where: { artistId: artist.id },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(
    blocks.map((b) => ({
      id: b.id,
      type: b.type,
      date: b.date.toISOString().slice(0, 10),
      allDay: b.allDay,
      timeStart: b.timeStart?.toISOString() ?? null,
      timeEnd: b.timeEnd?.toISOString() ?? null,
      reason: b.reason,
    }))
  );
}

export async function POST(req: NextRequest) {
  const artist = await getPilotArtist();
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const body = (await req.json()) as {
    type: "BLOCKED" | "TRAVEL" | "PREFERRED_OFF";
    date: string;
    allDay?: boolean;
    timeStart?: string | null;
    timeEnd?: string | null;
    reason?: string | null;
  };

  if (!body.type || !body.date) {
    return NextResponse.json({ error: "type and date required" }, { status: 400 });
  }

  const block = await prisma.artistAvailability.create({
    data: {
      artistId: artist.id,
      type: body.type,
      date: new Date(body.date),
      allDay: body.allDay ?? true,
      timeStart: body.timeStart ? new Date(body.timeStart) : null,
      timeEnd: body.timeEnd ? new Date(body.timeEnd) : null,
      reason: body.reason ?? null,
    },
  });

  return NextResponse.json({
    id: block.id,
    type: block.type,
    date: block.date.toISOString().slice(0, 10),
    allDay: block.allDay,
    reason: block.reason,
  });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.artistAvailability.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
