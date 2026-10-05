import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { startOfToday } from "@/lib/today";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

// For artists: nights venues have asked to fill, soonest first, and whether
// this artist is free that day. Venues post these knowing acts will see them
// and get in touch.
export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = startOfToday();
  const nights = await prisma.openNight.findMany({
    where: { status: "open", date: { gte: today } },
    orderBy: { date: "asc" },
    take: 100,
    include: { venueAccount: { select: { name: true, city: true, contactName: true, email: true } } },
  });

  const busy = new Set(
    (await prisma.show.findMany({ where: { artistId: artist.id, status: "CONFIRMED", date: { gte: today } }, select: { date: true } }))
      .map((s) => s.date.toISOString().slice(0, 10))
  );
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return NextResponse.json({
    ok: true,
    artistName: artist.name,
    nights: nights.map((n) => {
      const iso = n.date.toISOString().slice(0, 10);
      return {
        id: n.id,
        date: iso,
        budget: n.budget,
        notes: n.notes,
        venueName: n.venueAccount.name,
        city: n.venueAccount.city,
        contactName: n.venueAccount.contactName,
        email: n.venueAccount.email,
        free: !busy.has(iso),
        // A booking link for exactly this venue and night.
        bookingLink: `${appUrl}/${slugify(artist.name)}?date=${iso}&night=${n.id}`,
      };
    }),
  });
}
