import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { generateOutreachEmail } from "@/lib/claude";
import { slugify } from "@/lib/utils";
import { computeAvailableDates } from "@/lib/available-dates";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { venueId } = (await req.json()) as { venueId?: string };
  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }

  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const venue = await prisma.venue.findFirst({
    where: { id: venueId, artistId: artist.id },
    include: { nearestShow: true, artist: true },
  });

  if (!venue) {
    return NextResponse.json({ error: "venue not found" }, { status: 404 });
  }

  // Compute open dates around the venue's nearest show so the email can
  // propose concrete options instead of asking vaguely "around then?".
  let availableDates: { iso: string; pretty: string }[] = [];
  if (venue.nearestShow) {
    const [allShows, availabilityBlocks] = await Promise.all([
      prisma.show.findMany({
        where: { artistId: venue.artistId, status: "CONFIRMED" },
        select: { id: true, date: true, timeStart: true, timeEnd: true, venueName: true },
      }),
      prisma.artistAvailability.findMany({
        where: { artistId: venue.artistId },
        select: { date: true, type: true },
      }),
    ]);
    availableDates = computeAvailableDates({
      allShows,
      nearestShow: venue.nearestShow,
      venueType: venue.venueType,
      availabilityBlocks,
    }).map((d) => ({
      iso: d.iso,
      pretty: d.pretty,
      timeContext: d.timeContext,
      sameDayShowName: d.sameDayShowName,
    }));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const bookingLink = `${appUrl}/${slugify(venue.artist.name)}?ref=${venue.id}`;

  const email = await generateOutreachEmail({
    artist: {
      name: venue.artist.name,
      genre: venue.artist.genre,
      bio: venue.artist.bio,
      drawDescription: venue.artist.drawDescription,
      hometown: venue.artist.hometown,
      instagramHandle: venue.artist.instagramHandle,
      videoReelUrl: venue.artist.videoReelUrl,
      epkUrl: venue.artist.epkUrl,
    },
    venue: {
      name: venue.name,
      city: venue.city,
      state: venue.state,
      venueType: venue.venueType,
      decisionMakerName: venue.decisionMakerName,
      decisionMakerRole: venue.decisionMakerRole,
      narrative: venue.narrative,
      cuisine: venue.cuisine,
      vibe: venue.vibe,
      hostsLiveMusic: venue.hostsLiveMusic,
      genresHosted: venue.genresHosted,
    },
    nearestShow: venue.nearestShow
      ? {
          venueName: venue.nearestShow.venueName,
          city: venue.nearestShow.city,
          state: venue.nearestShow.state,
          date: venue.nearestShow.date.toISOString().slice(0, 10),
          distanceMiles: venue.distanceMiles ?? 0,
        }
      : null,
    availableDates,
    bookingLink,
  });

  return NextResponse.json(email);
}
