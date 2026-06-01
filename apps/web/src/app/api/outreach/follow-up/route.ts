import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { generateOutreachEmail } from "@/lib/claude";
import { sendEmail } from "@/lib/sendgrid";
import { slugify } from "@/lib/utils";
import { computeAvailableDates } from "@/lib/available-dates";

export const dynamic = "force-dynamic";

// Two follow-up tiers:
//   Priority 1 — OPENED but no reply after 72h: hottest leads, different angle
//   Priority 2 — SENT but not opened after 48h: resend with new subject line

const OPENED_NO_REPLY_HOURS = 72;
const SENT_NO_OPEN_HOURS = 48;
const FOLLOW_UP_SUBJECTS = {
  opened_no_reply: [
    "quick question",
    "still have that date open",
    "following up — {city} date",
  ],
  sent_no_open: [
    "did this land in spam?",
    "{miles}mi from {city} — one open date",
    "passing through {city} this summer",
  ],
};

function renderSubject(
  template: string,
  ctx: { city: string; miles: number; artistName: string }
): string {
  return template
    .replace("{city}", ctx.city)
    .replace("{miles}", String(Math.round(ctx.miles)))
    .replace("{artist}", ctx.artistName);
}

function pickSubject(
  tier: "opened_no_reply" | "sent_no_open",
  used: string[],
  ctx: { city: string; miles: number; artistName: string }
): string {
  const pool = FOLLOW_UP_SUBJECTS[tier].map((t) => renderSubject(t, ctx));
  const unused = pool.filter((s) => !used.includes(s));
  if (unused.length === 0) return pool[0]; // fallback: reuse first
  return unused[0];
}

export async function GET() {
  const now = new Date();
  const openedCutoff = new Date(now.getTime() - OPENED_NO_REPLY_HOURS * 3600000);
  const sentCutoff = new Date(now.getTime() - SENT_NO_OPEN_HOURS * 3600000);

  const openedNoReply = await prisma.outreach.findMany({
    where: {
      status: "OPENED",
      openedAt: { lte: openedCutoff },
      venue: { pipeline: { stage: { in: ["EMAILED", "CALLED"] } } },
    },
    include: {
      venue: { include: { nearestShow: true, pipeline: true } },
      artist: true,
    },
    orderBy: { openedAt: "asc" },
    take: 50,
  });

  const sentNoOpen = await prisma.outreach.findMany({
    where: {
      status: "SENT",
      sentAt: { lte: sentCutoff },
      openedAt: null,
      venue: { pipeline: { stage: "EMAILED" } },
    },
    include: {
      venue: { include: { nearestShow: true, pipeline: true } },
      artist: true,
    },
    orderBy: { sentAt: "asc" },
    take: 50,
  });

  return NextResponse.json({
    openedNoReply: openedNoReply.length,
    sentNoOpen: sentNoOpen.length,
    total: openedNoReply.length + sentNoOpen.length,
  });
}

export async function POST(req: NextRequest) {
  const { limit = 25, tier }: { limit?: number; tier?: "opened_no_reply" | "sent_no_open" | "both" } =
    await req.json().catch(() => ({}));

  const now = new Date();
  const openedCutoff = new Date(now.getTime() - OPENED_NO_REPLY_HOURS * 3600000);
  const sentCutoff = new Date(now.getTime() - SENT_NO_OPEN_HOURS * 3600000);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const candidates: Array<{
    outreach: { id: string; subjectLine: string | null; venueId: string };
    venue: { id: string; name: string; city: string; state: string; venueType: string; venueTypeFull: any; decisionMakerName: string | null; decisionMakerRole: string | null; decisionMakerEmail: string | null; email: string | null; distanceMiles: number | null; nearestShow: any; narrative: string | null; cuisine: string | null; vibe: string[]; hostsLiveMusic: boolean | null; genresHosted: string[]; artistId: string };
    artist: any;
    followUpTier: "opened_no_reply" | "sent_no_open";
  }> = [];

  const includeTier = tier ?? "both";

  if (includeTier === "opened_no_reply" || includeTier === "both") {
    const rows = await prisma.outreach.findMany({
      where: {
        status: "OPENED",
        openedAt: { lte: openedCutoff },
        venue: { pipeline: { stage: { in: ["EMAILED", "CALLED"] } } },
      },
      include: { venue: { include: { nearestShow: true } }, artist: true },
      orderBy: { openedAt: "asc" },
      take: limit,
    });
    for (const r of rows) {
      if (!r.venue.decisionMakerEmail && !r.venue.email) continue;
      candidates.push({
        outreach: { id: r.id, subjectLine: r.subjectLine, venueId: r.venueId },
        venue: { ...r.venue, venueTypeFull: r.venue.venueType },
        artist: r.artist,
        followUpTier: "opened_no_reply",
      });
    }
  }

  if (includeTier === "sent_no_open" || includeTier === "both") {
    const remaining = limit - candidates.length;
    if (remaining > 0) {
      const rows = await prisma.outreach.findMany({
        where: {
          status: "SENT",
          sentAt: { lte: sentCutoff },
          openedAt: null,
          venue: { pipeline: { stage: "EMAILED" } },
        },
        include: { venue: { include: { nearestShow: true } }, artist: true },
        orderBy: { sentAt: "asc" },
        take: remaining,
      });
      for (const r of rows) {
        if (!r.venue.decisionMakerEmail && !r.venue.email) continue;
        candidates.push({
          outreach: { id: r.id, subjectLine: r.subjectLine, venueId: r.venueId },
          venue: { ...r.venue, venueTypeFull: r.venue.venueType },
          artist: r.artist,
          followUpTier: "sent_no_open",
        });
      }
    }
  }

  const artistId = candidates[0]?.artist?.id;
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

  let sent = 0;
  let errors = 0;

  for (const c of candidates) {
    const venue = c.venue;
    const recipient = venue.decisionMakerEmail ?? venue.email;
    if (!recipient) continue;

    const usedSubjects = [c.outreach.subjectLine ?? ""].filter(Boolean);
    const subject = pickSubject(c.followUpTier, usedSubjects, {
      city: venue.city,
      miles: venue.distanceMiles ?? 0,
      artistName: c.artist.name,
    });

    const availableDates = venue.nearestShow
      ? computeAvailableDates({
          allShows,
          nearestShow: venue.nearestShow,
          venueType: venue.venueTypeFull,
          availabilityBlocks,
        }).map((d) => ({ iso: d.iso, pretty: d.pretty, timeContext: d.timeContext, sameDayShowName: d.sameDayShowName }))
      : [];

    try {
      const email = await generateOutreachEmail({
        artist: {
          name: c.artist.name,
          genre: c.artist.genre,
          bio: c.artist.bio,
          drawDescription: c.artist.drawDescription,
          hometown: c.artist.hometown,
          videoReelUrl: c.artist.videoReelUrl,
          epkUrl: c.artist.epkUrl,
        },
        venue: {
          name: venue.name,
          city: venue.city,
          state: venue.state,
          venueType: venue.venueTypeFull,
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
        bookingLink: `${appUrl}/${slugify(c.artist.name)}?ref=${venue.id}`,
      });

      // Override subject with the follow-up variant
      const delivery = await sendEmail({
        to: recipient,
        subject,
        text: email.body,
        replyTo: c.artist.contactEmail,
      });

      await prisma.$transaction([
        prisma.outreach.create({
          data: {
            venueId: venue.id,
            artistId: venue.artistId,
            channel: "EMAIL",
            status: "SENT",
            subjectLine: subject,
            body: email.body,
            sentAt: new Date(),
            sendgridMessageId: delivery.messageId,
            variant: c.followUpTier === "opened_no_reply" ? "follow_up_hot" : "follow_up_cold",
          },
        }),
      ]);

      sent++;
    } catch {
      errors++;
    }
  }

  const remaining = await prisma.outreach.count({
    where: {
      OR: [
        { status: "OPENED", openedAt: { lte: openedCutoff } },
        { status: "SENT", sentAt: { lte: sentCutoff }, openedAt: null },
      ],
    },
  });

  return NextResponse.json({ ok: true, sent, errors, remaining });
}
