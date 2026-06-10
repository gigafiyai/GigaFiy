import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ insights: [], funnel: null, subjectVariants: [], survey1Breakdown: {}, latestGeneratedAt: null });

  const [insights, pipelines, outreaches, surveys] = await Promise.all([
    prisma.insight.findMany({
      where: { artistId: artist.id, active: true },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.pipeline.findMany({ where: { artistId: artist.id } }),
    prisma.outreach.findMany({ where: { artistId: artist.id, channel: "EMAIL" } }),
    prisma.survey.findMany({
      where: { pipeline: { artistId: artist.id }, completedAt: { not: null } },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const p of pipelines) counts[p.stage] = (counts[p.stage] ?? 0) + 1;

  const funnel = {
    totalVenues: pipelines.length,
    sent: outreaches.filter((o) => o.status !== "QUEUED").length,
    opened: outreaches.filter((o) => o.openedAt).length,
    clicked: outreaches.filter((o) => o.clickedAt).length,
    replied: outreaches.filter((o) => o.status === "REPLIED").length,
    interested: counts.INTERESTED ?? 0,
    deposit: counts.DEPOSIT ?? 0,
    booked: counts.BOOKED ?? 0,
    cancelled: counts.CANCELLED ?? 0,
  };

  const subjBuckets: Record<string, { sent: number; opened: number }> = {};
  for (const o of outreaches) {
    if (!o.subjectLine || o.status === "QUEUED") continue;
    const b = (subjBuckets[o.subjectLine] ||= { sent: 0, opened: 0 });
    b.sent++;
    if (o.openedAt) b.opened++;
  }
  const subjectVariants = Object.entries(subjBuckets)
    .map(([subject, { sent, opened }]) => ({
      subject,
      sent,
      opened,
      openRate: sent === 0 ? 0 : Math.round((opened / sent) * 100),
    }))
    .sort((a, b) => b.sent - a.sent)
    .slice(0, 8);

  // Survey 1 per-question response breakdown.
  const survey1Breakdown: Record<string, Record<string, number>> = {
    q1: {}, q2: {}, q3: {}, q4: {},
  };
  for (const s of surveys.filter((s) => s.surveyType === "POST_BOOKING")) {
    for (const k of ["q1", "q2", "q3", "q4"] as const) {
      const answer = s[`${k}Answer` as const];
      if (answer) {
        survey1Breakdown[k][answer] = (survey1Breakdown[k][answer] ?? 0) + 1;
      }
    }
  }

  return NextResponse.json({
    insights: insights.map((i) => ({
      id: i.id,
      signal: i.signal,
      stat: i.stat,
      action: i.action,
      impact: i.impact,
      generatedAt: i.generatedAt.toISOString(),
    })),
    funnel,
    subjectVariants,
    survey1Breakdown,
    latestGeneratedAt: insights[0]?.generatedAt.toISOString() ?? null,
  });
}
