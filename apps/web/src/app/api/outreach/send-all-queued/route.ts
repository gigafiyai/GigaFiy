import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { generateOutreachEmail } from "@/lib/claude";
import { sendEmail } from "@/lib/sendgrid";
import { slugify } from "@/lib/utils";
import { computeAvailableDates } from "@/lib/available-dates";

export const dynamic = "force-dynamic";

// Bulk: generate + send emails to every venue whose pipeline is QUEUED and
// has a contact email on file. Caller can pass { limit } to throttle. Returns
// a summary so the UI can be incremental ("send next 25").
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
    pipelineIds?: string[];
    qualityOnly?: boolean;
  };
  const limit = Math.min(Math.max(body.limit ?? 25, 1), 200);
  const ids = body.pipelineIds && body.pipelineIds.length > 0 ? body.pipelineIds : null;
  // qualityOnly: default true — only email venues likely to book live music
  const qualityOnly = body.qualityOnly !== false;

  // Quality filter: only email venue types likely to book live music
  const qualityVenueIds = qualityOnly && !ids
    ? (await prisma.venue.findMany({
        where: { venueType: { in: ["MUSIC_CLUB", "BAR", "ARTS_CENTER"] } },
        select: { id: true },
      })).map((v) => v.id)
    : null;

  const queued = await prisma.pipeline.findMany({
    where: ids
      ? { id: { in: ids } }
      : { stage: "QUEUED", ...(qualityVenueIds ? { venueId: { in: qualityVenueIds } } : {}) },
    include: {
      venue: { include: { nearestShow: true } },
      artist: true,
    },
    take: ids ? ids.length : limit * 3,
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Pre-load all confirmed shows + availability blocks once per call.
  const artistIds = [...new Set(queued.map((p) => p.artistId))];
  const [allShows, allBlocks] = await Promise.all([
    prisma.show.findMany({
      where: { artistId: { in: artistIds }, status: "CONFIRMED" },
      select: { id: true, date: true, artistId: true, timeStart: true, timeEnd: true, venueName: true },
    }),
    prisma.artistAvailability.findMany({
      where: { artistId: { in: artistIds } },
      select: { artistId: true, date: true, type: true },
    }),
  ]);
  const showsByArtist = new Map<string, typeof allShows>();
  for (const s of allShows) {
    if (!showsByArtist.has(s.artistId)) showsByArtist.set(s.artistId, []);
    showsByArtist.get(s.artistId)!.push(s);
  }
  const blocksByArtist = new Map<string, typeof allBlocks>();
  for (const b of allBlocks) {
    if (!blocksByArtist.has(b.artistId)) blocksByArtist.set(b.artistId, []);
    blocksByArtist.get(b.artistId)!.push(b);
  }

  let sent = 0;
  let skippedNoEmail = 0;
  let errors = 0;
  const errorDetails: string[] = [];

  for (const p of queued) {
    if (sent >= limit) break;
    const venue = p.venue;
    const recipient = venue.decisionMakerEmail ?? venue.email;
    if (!recipient) {
      skippedNoEmail++;
      continue;
    }

    let availableDates: { iso: string; pretty: string }[] = [];
    if (venue.nearestShow) {
      const artistShows = showsByArtist.get(p.artistId) ?? [];
      const artistBlocks = blocksByArtist.get(p.artistId) ?? [];
      availableDates = computeAvailableDates({
        allShows: artistShows,
        nearestShow: venue.nearestShow,
        venueType: venue.venueType,
        availabilityBlocks: artistBlocks,
      }).map((d) => ({
        iso: d.iso,
        pretty: d.pretty,
        timeContext: d.timeContext,
        sameDayShowName: d.sameDayShowName,
      }));
    }

    try {
      // Generate (uses Claude if key set, template otherwise).
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

      // Send (uses SendGrid if key set, console log otherwise).
      const delivery = await sendEmail({
        to: recipient,
        subject: email.subject,
        text: email.body,
        replyTo: p.artist.contactEmail,
      });

      await prisma.$transaction([
        prisma.outreach.create({
          data: {
            venueId: venue.id,
            artistId: venue.artistId,
            channel: "EMAIL",
            status: "SENT",
            subjectLine: email.subject,
            body: email.body,
            sentAt: new Date(),
            sendgridMessageId: delivery.messageId,
            variant: "a",
          },
        }),
        prisma.pipeline.update({
          where: { id: p.id },
          // Only move QUEUED → EMAILED; don't downgrade INTERESTED/CALLED.
          data: p.stage === "QUEUED" ? { stage: "EMAILED" } : {},
        }),
      ]);

      sent++;
    } catch (e) {
      errors++;
      if (errorDetails.length < 5) {
        errorDetails.push(
          `${venue.name}: ${e instanceof Error ? e.message : "unknown"}`
        );
      }
    }
  }

  const remainingQueued = await prisma.pipeline.count({
    where: { stage: "QUEUED", ...(qualityVenueIds ? { venueId: { in: qualityVenueIds } } : {}) }
  });

  return NextResponse.json({
    ok: true,
    sent,
    skippedNoEmail,
    errors,
    errorDetails,
    remainingQueued,
  });
}
