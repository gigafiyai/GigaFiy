import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { summarizeIncome } from "@/lib/income";

export const dynamic = "force-dynamic";

// The artist's money picture: earned to date, contracted upcoming, deposits
// collected, and a probability-weighted forecast of the open pipeline.
export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const now = new Date();

  const [shows, pipelines, paidDeposits] = await Promise.all([
    prisma.show.findMany({
      where: { artistId: artist.id },
      select: { date: true, status: true, fee: true, revenue: true },
    }),
    prisma.pipeline.findMany({
      where: { artistId: artist.id },
      select: { stage: true },
    }),
    prisma.pipeline.findMany({
      where: { artistId: artist.id, depositPaidAt: { not: null } },
      select: { depositAmount: true },
    }),
  ]);

  const completedRevenue = shows
    .filter((s) => s.status === "COMPLETED")
    .reduce((sum, s) => sum + (s.revenue ?? s.fee ?? 0), 0);

  const upcomingConfirmed = shows.filter((s) => s.status === "CONFIRMED" && s.date >= now);
  const confirmedUpcomingFees = upcomingConfirmed.reduce((sum, s) => sum + (s.fee ?? 0), 0);

  const depositsCollected = paidDeposits.reduce((sum, p) => sum + (p.depositAmount ?? 0), 0);

  // Average fee from real entered fees; fall back to a sensible default.
  const fees = shows.map((s) => s.fee).filter((f): f is number => !!f && f > 0);
  const avgFee = fees.length ? fees.reduce((a, b) => a + b, 0) / fees.length : 350;

  // Only open leads contribute to the forecast (terminal stages weight to 0,
  // but we exclude them so the "active leads" count is meaningful).
  const openLeads = pipelines.filter(
    (p) => !["BOOKED", "DECLINED", "CANCELLED", "OPTED_OUT"].includes(p.stage)
  );

  const summary = summarizeIncome({
    completedRevenue,
    confirmedUpcomingFees,
    upcomingCount: upcomingConfirmed.length,
    depositsCollected,
    pipelineLeads: openLeads,
    avgFee,
  });

  return NextResponse.json({ ok: true, ...summary, openLeads: openLeads.length });
}
