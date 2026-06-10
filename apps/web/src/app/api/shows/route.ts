import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const shows = await prisma.show.findMany({
    where: { artistId: artist.id },
    include: {
      _count: { select: { nearbyVenues: true } },
    },
    orderBy: { date: "asc" },
  });

  const result = shows.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    dayOfWeek: s.dayOfWeek,
    city: s.city,
    state: s.state,
    venueName: s.venueName,
    address: s.address,
    lat: s.lat,
    lng: s.lng,
    timeStart: s.timeStart?.toISOString() ?? null,
    timeEnd: s.timeEnd?.toISOString() ?? null,
    showType: s.showType,
    status: s.status,
    venuesDiscovered: s._count.nearbyVenues,
  }));

  return NextResponse.json(result);
}
