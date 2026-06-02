import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Returns all logged calls, ranked by callScore (best calls first).
// Feeds the call log view + the eventual training dataset.
export async function GET() {
  const calls = await prisma.call.findMany({
    include: { venue: { select: { name: true, city: true, state: true, decisionMakerEmail: true, email: true } } },
    orderBy: [{ callScore: "desc" }, { calledAt: "desc" }],
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
    hasEmail: !!(c.venue.decisionMakerEmail || c.venue.email),
    durationSeconds: c.durationSeconds,
    calledAt: c.calledAt?.toISOString() ?? null,
  }));

  // Summary stats for the header
  const stats = {
    total: result.length,
    tierA: result.filter((c) => c.callTier === "A").length,
    tierB: result.filter((c) => c.callTier === "B").length,
    emailsCaptured: result.filter((c) => c.contactNameCaptured).length,
    avgScore: result.length
      ? Math.round(result.reduce((s, c) => s + (c.callScore ?? 0), 0) / result.length)
      : 0,
  };

  return NextResponse.json({ calls: result, stats });
}
