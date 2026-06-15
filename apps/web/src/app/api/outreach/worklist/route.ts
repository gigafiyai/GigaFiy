import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { outreachPriority, daysUntil } from "@/lib/lead-ranking";

export const dynamic = "force-dynamic";

// The manual-outreach worklist: the artist's upcoming shows, each with the
// best-ranked venues nearby that he can call or email himself. Gigify does the
// research + ranking; the artist makes the contact.
export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const shows = await prisma.show.findMany({
    where: { artistId: artist.id, status: "CONFIRMED", date: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
    orderBy: { date: "asc" },
    select: { id: true, venueName: true, city: true, state: true, date: true, dayOfWeek: true },
  });

  // All ranked venues anchored to those shows, in one query.
  const venues = await prisma.venue.findMany({
    where: {
      artistId: artist.id,
      optedOut: false,
      nearestShowId: { in: shows.map((s) => s.id) },
    },
    select: {
      id: true, name: true, city: true, state: true, venueType: true,
      phone: true, email: true, decisionMakerEmail: true, decisionMakerName: true,
      leadTier: true, leadScore: true, leadReason: true, distanceMiles: true,
      nearestShowId: true,
      outreach: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, sentAt: true } },
      calls: { orderBy: { calledAt: "desc" }, take: 1, select: { status: true, calledAt: true } },
    },
  });

  const nowMs = Date.now();
  const byShow = new Map<string, typeof venues>();
  for (const v of venues) {
    if (!byShow.has(v.nearestShowId!)) byShow.set(v.nearestShowId!, []);
    byShow.get(v.nearestShowId!)!.push(v);
  }

  const result = shows.map((s) => {
    const vs = (byShow.get(s.id) ?? [])
      .map((v) => {
        const email = v.decisionMakerEmail ?? v.email;
        return {
          id: v.id,
          name: v.name,
          city: v.city,
          state: v.state,
          venueType: v.venueType,
          phone: v.phone,
          email,
          decisionMakerName: v.decisionMakerName,
          leadTier: v.leadTier,
          leadScore: v.leadScore ?? 0,
          leadReason: v.leadReason,
          distanceMiles: v.distanceMiles,
          canCall: !!v.phone,
          canEmail: !!email,
          lastOutreach: v.outreach[0]?.status ?? null,
          lastCall: v.calls[0]?.status ?? null,
          priority: outreachPriority({ leadScore: v.leadScore, leadTier: v.leadTier, daysUntilShow: daysUntil(s.date, nowMs) }),
        };
      })
      .sort((a, b) => b.priority - a.priority);

    const highRanked = vs.filter((v) => v.leadTier === "A" || v.leadTier === "B");
    return {
      id: s.id,
      venueName: s.venueName,
      city: s.city,
      state: s.state,
      dayOfWeek: s.dayOfWeek,
      date: s.date.toISOString().slice(0, 10),
      counts: {
        call: highRanked.filter((v) => v.canCall).length,
        email: highRanked.filter((v) => v.canEmail && !v.canCall).length,
        highRanked: highRanked.length,
      },
      venues: vs.slice(0, 30),
    };
  });

  return NextResponse.json({ ok: true, shows: result });
}
