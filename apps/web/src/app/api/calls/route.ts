import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Call history — every logged call, most recent first. The proprietary
// transcript+outcome dataset (the moat) surfaced for the artist + future evals.
export async function GET() {
  const calls = await prisma.call.findMany({
    include: { venue: { select: { name: true, city: true, state: true, decisionMakerEmail: true, email: true } } },
    orderBy: [{ calledAt: "desc" }],
    take: 200,
  });

  const result = calls.map((c) => ({
    id: c.id,
    venueName: c.venue.name,
    city: c.venue.city,
    state: c.venue.state,
    status: c.status,
    summary: c.summary,
    sentiment: c.sentiment,
    callScore: c.callScore,
    callTier: c.callTier,
    nextAction: c.nextAction,
    contactNameCaptured: c.contactNameCaptured,
    agreedToBook: c.agreedToBook,
    agreedDate: c.agreedDate ? c.agreedDate.toISOString().slice(0, 10) : null,
    agreedPrice: c.agreedPrice,
    recordingUrl: c.recordingUrl,
    hasTranscript: !!c.transcript,
    hasEmail: !!(c.venue.decisionMakerEmail || c.venue.email),
    durationSeconds: c.durationSeconds,
    calledAt: c.calledAt?.toISOString() ?? null,
  }));

  const stats = {
    total: result.length,
    booked: result.filter((c) => c.agreedToBook).length,
    tierA: result.filter((c) => c.callTier === "A").length,
    tierB: result.filter((c) => c.callTier === "B").length,
    avgScore: result.filter((c) => c.callScore != null).length
      ? Math.round(result.reduce((s, c) => s + (c.callScore ?? 0), 0) / result.filter((c) => c.callScore != null).length)
      : 0,
  };

  return NextResponse.json({ calls: result, stats });
}
