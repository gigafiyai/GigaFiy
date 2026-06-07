// Send one personalized outreach email to a venue: generate (Claude or
// template), send (Resend/SendGrid), log the Outreach row, and advance the
// pipeline. Used by the campaign runner so each scheduled item can be sent with
// its assigned sending subdomain.

import { prisma } from "@gigify/db";
import { generateOutreachEmail } from "@/lib/claude";
import { sendEmail } from "@/lib/email";
import { slugify } from "@/lib/utils";
import { computeAvailableDates } from "@/lib/available-dates";

export type SendOutreachResult = {
  ok: boolean;
  mode?: "resend" | "sendgrid" | "logged";
  recipient?: string;
  error?: string;
};

export async function sendOutreachEmailToVenue(
  venueId: string,
  opts: { from?: string } = {}
): Promise<SendOutreachResult> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { artist: true, nearestShow: true, pipeline: true },
  });
  if (!venue) return { ok: false, error: "venue not found" };
  if (venue.optedOut) return { ok: false, error: "opted out" };

  const recipient = venue.decisionMakerEmail ?? venue.email;
  if (!recipient) return { ok: false, error: "no email on file" };

  const artist = venue.artist;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Concrete available dates (only when there's a nearby anchor show).
  let availableDates: { iso: string; pretty: string; timeContext?: string; sameDayShowName?: string }[] = [];
  if (venue.nearestShow) {
    const [shows, blocks] = await Promise.all([
      prisma.show.findMany({
        where: { artistId: artist.id, status: "CONFIRMED" },
        select: { id: true, date: true, timeStart: true, timeEnd: true, venueName: true },
      }),
      prisma.artistAvailability.findMany({
        where: { artistId: artist.id },
        select: { date: true, type: true },
      }),
    ]);
    availableDates = computeAvailableDates({
      allShows: shows,
      nearestShow: venue.nearestShow,
      venueType: venue.venueType,
      availabilityBlocks: blocks,
    }).map((d) => ({ iso: d.iso, pretty: d.pretty, timeContext: d.timeContext, sameDayShowName: d.sameDayShowName }));
  }

  try {
    const email = await generateOutreachEmail({
      artist: {
        name: artist.name,
        genre: artist.genre,
        bio: artist.bio,
        drawDescription: artist.drawDescription,
        hometown: artist.hometown,
        instagramHandle: artist.instagramHandle,
        videoReelUrl: artist.videoReelUrl,
        epkUrl: artist.epkUrl,
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
      bookingLink: `${appUrl}/${slugify(artist.name)}?ref=${venue.id}`,
    });

    const delivery = await sendEmail({
      to: recipient,
      subject: email.subject,
      text: email.body,
      replyTo: artist.contactEmail,
      from: opts.from,
      footer: {
        artistName: artist.name,
        mailingAddress: artist.mailingAddress,
        unsubscribeVenueId: venue.id,
      },
    });

    await prisma.outreach.create({
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
    });
    // Only QUEUED → EMAILED; never downgrade INTERESTED/CALLED.
    if (venue.pipeline && venue.pipeline.stage === "QUEUED") {
      await prisma.pipeline.update({ where: { id: venue.pipeline.id }, data: { stage: "EMAILED" } });
    }

    return { ok: delivery.delivered || delivery.mode === "logged", mode: delivery.mode, recipient, error: delivery.error };
  } catch (e) {
    return { ok: false, recipient, error: e instanceof Error ? e.message : "send failed" };
  }
}
