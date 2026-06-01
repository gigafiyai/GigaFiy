import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const shows = await prisma.show.findMany({
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
