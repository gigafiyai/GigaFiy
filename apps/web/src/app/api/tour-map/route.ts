import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Data for the Tour Map: the artist's confirmed routing (chronological) plus
// the best venue leads as points, colored by lead tier and pipeline status.
export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [shows, venues] = await Promise.all([
    prisma.show.findMany({
      where: { artistId: artist.id, status: { in: ["CONFIRMED", "COMPLETED"] } },
      orderBy: { date: "asc" },
      select: { id: true, venueName: true, city: true, state: true, date: true, lat: true, lng: true, status: true },
    }),
    // Cap to the strongest leads so the map stays snappy.
    prisma.venue.findMany({
      where: { artistId: artist.id, optedOut: false },
      orderBy: { leadScore: "desc" },
      take: 400,
      select: {
        id: true, name: true, city: true, state: true, lat: true, lng: true,
        leadTier: true, leadScore: true, pipeline: { select: { stage: true } },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    shows: shows.map((s) => ({
      id: s.id, venueName: s.venueName, city: s.city, state: s.state,
      date: s.date.toISOString().slice(0, 10), lng: s.lng, lat: s.lat, status: s.status,
    })),
    venues: venues.map((v) => ({
      id: v.id, name: v.name, city: v.city, state: v.state, lng: v.lng, lat: v.lat,
      leadTier: v.leadTier, stage: v.pipeline?.stage ?? null,
    })),
  });
}
