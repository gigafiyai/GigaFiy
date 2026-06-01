import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { generateInsights, type InsightContext } from "@/lib/insights";

export const dynamic = "force-dynamic";

export async function POST() {
  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const [pipelines, outreaches, surveys] = await Promise.all([
    prisma.pipeline.findMany({
      where: { artistId: artist.id },
      include: { venue: true },
    }),
    prisma.outreach.findMany({
      where: { artistId: artist.id, channel: "EMAIL" },
    }),
    prisma.survey.findMany({ where: { pipeline: { artistId: artist.id } } }),
  ]);

  const pipelineCounts: Record<string, number> = {};
  for (const p of pipelines) {
    pipelineCounts[p.stage] = (pipelineCounts[p.stage] ?? 0) + 1;
  }

  const sent = outreaches.filter((o) => o.status !== "QUEUED").length;
  const opened = outreaches.filter((o) => o.openedAt != null).length;
  const clicked = outreaches.filter((o) => o.clickedAt != null).length;
  const replied = outreaches.filter((o) => o.status === "REPLIED").length;

  // Subject line A/B: bucket on subject text.
  const subjectBuckets: Record<string, { sent: number; opened: number }> = {};
  for (const o of outreaches) {
    if (!o.subjectLine || o.status === "QUEUED") continue;
    const b = (subjectBuckets[o.subjectLine] ||= { sent: 0, opened: 0 });
    b.sent++;
    if (o.openedAt) b.opened++;
  }
  const subjectVariants = Object.entries(subjectBuckets)
    .map(([subject, { sent, opened }]) => ({
      subject,
      sent,
      opened,
      openRate: sent === 0 ? 0 : Math.round((opened / sent) * 100),
    }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 6);

  const survey1 = surveys
    .filter((s) => s.surveyType === "POST_BOOKING" && s.completedAt)
    .map((s) => ({ q1: s.q1Answer, q2: s.q2Answer, q3: s.q3Answer, q4: s.q4Answer }));
  const survey2 = surveys
    .filter((s) => s.surveyType === "DAY_AFTER" && s.completedAt)
    .map((s) => ({
      q1: s.q1Answer,
      q2: s.q2Answer,
      q3: s.q3Answer,
      q4: s.q4Answer,
      q5: s.q5Answer,
    }));

  const bookedVenueTypes: Record<string, number> = {};
  for (const p of pipelines.filter((p) => p.stage === "BOOKED")) {
    const t = p.venue.venueType;
    bookedVenueTypes[t] = (bookedVenueTypes[t] ?? 0) + 1;
  }

  const queued = pipelineCounts.QUEUED ?? 0;
  const emailed = pipelineCounts.EMAILED ?? 0;
  const interested = pipelineCounts.INTERESTED ?? 0;
  const booked = pipelineCounts.BOOKED ?? 0;
  const conversionRates = {
    queuedToEmailed: queued + emailed === 0 ? 0 : Math.round((emailed / (queued + emailed)) * 100),
    emailedToInterested: emailed + interested === 0 ? 0 : Math.round((interested / (emailed + interested)) * 100),
    interestedToBooked: interested + booked === 0 ? 0 : Math.round((booked / (interested + booked)) * 100),
  };

  const ctx: InsightContext = {
    artistName: artist.name,
    pipelineCounts,
    totalVenues: pipelines.length,
    emailMetrics: { sent, opened, clicked, replied },
    conversionRates,
    subjectVariants,
    survey1Responses: survey1,
    survey2Responses: survey2,
    bookedVenueTypes,
  };

  const { cards, source } = await generateInsights(ctx);

  // Deactivate prior insights and save new batch.
  await prisma.insight.updateMany({
    where: { artistId: artist.id, active: true },
    data: { active: false },
  });
  for (const c of cards) {
    await prisma.insight.create({
      data: {
        artistId: artist.id,
        signal: c.signal,
        stat: c.stat ?? null,
        action: c.action,
        impact: c.impact,
        sourceData: JSON.stringify({
          counts: pipelineCounts,
          emails: ctx.emailMetrics,
          conversion: conversionRates,
        }),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    source,
    cardsGenerated: cards.length,
    funnel: { ...ctx.emailMetrics, ...pipelineCounts },
    subjectVariants,
  });
}
