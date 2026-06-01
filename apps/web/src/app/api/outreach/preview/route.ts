import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { generateOutreachEmail } from "@/lib/claude";
import { slugify } from "@/lib/utils";
import { computeAvailableDates } from "@/lib/available-dates";

export const dynamic = "force-dynamic";

// Samples N venues from the QUEUED pipeline and generates preview emails.
// Used by the bulk-send confirmation modal so the artist can eyeball
// a representative sample before firing 800+ emails.

export async function POST(req: NextRequest) {
  const { sampleSize = 3 } = (await req.json().catch(() => ({}))) as { sampleSize?: number };

  const totalQueued = await prisma.pipeline.count({ where: { stage: "QUEUED" } });
  const totalWithEmail = await prisma.venue.count({
    where: {
      OR: [{ decisionMakerEmail: { not: null } }, { email: { not: null } }],
      pipeline: { stage: "QUEUED" },
    },
  });

  // Sample across early / middle / late in the queue for variety.
  const take = Math.min(sampleSize, totalWithEmail);
  const spread = Math.max(1, Math.floor(totalWithEmail / take));
  const samples = await prisma.pipeline.findMany({
    where: {
      stage: "QUEUED",
      venue: { OR: [{ decisionMakerEmail: { not: null } }, { email: { not: null } }] },
    },
    include: {
      venue: { include: { nearestShow: true } },
      artist: true,
    },
    take,
    skip: 0,
    orderBy: [{ venue: { nearestShow: { date: "asc" } } }, { venue: { distanceMiles: "asc" } }],
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const artistId = samples[0]?.artistId;
  const [allShows, availabilityBlocks] = artistId
    ? await Promise.all([
        prisma.show.findMany({
          where: { artistId, status: "CONFIRMED" },
          select: { id: true, date: true, timeStart: true, timeEnd: true, venueName: true },
        }),
        prisma.artistAvailability.findMany({
          where: { artistId },
          select: { date: true, type: true },
        }),
      ])
    : [[], []];

  const previews = await Promise.all(
    samples.map(async (p) => {
      const venue = p.venue;
      const availableDates = venue.nearestShow
        ? computeAvailableDates({
            allShows,
            nearestShow: venue.nearestShow,
            venueType: venue.venueType,
            availabilityBlocks,
          }).map((d) => ({ iso: d.iso, pretty: d.pretty, timeContext: d.timeContext, sameDayShowName: d.sameDayShowName }))
        : [];

      const email = await generateOutreachEmail({
        artist: {
          name: p.artist.name,
          genre: p.artist.genre,
          bio: p.artist.bio,
          drawDescription: p.artist.drawDescription,
          hometown: p.artist.hometown,
          videoReelUrl: p.artist.videoReelUrl,
          epkUrl: p.artist.epkUrl,
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
        bookingLink: `${appUrl}/${slugify(p.artist.name)}?ref=${venue.id}`,
      });

      return {
        venueName: venue.name,
        city: venue.city,
        state: venue.state,
        venueType: venue.venueType,
        recipient: venue.decisionMakerEmail ?? venue.email,
        decisionMakerName: venue.decisionMakerName,
        subject: email.subject,
        body: email.body,
        source: email.source,
      };
    })
  );

  return NextResponse.json({
    totalQueued,
    totalWithEmail,
    totalSkipped: totalQueued - totalWithEmail,
    previews,
  });
}
