import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { daysUntil } from "@/lib/lead-ranking";
import { deriveAction, type WorklistAction } from "@/lib/worklist-engine";

export const dynamic = "force-dynamic";

// The self-refreshing worklist: the artist's upcoming shows, each with the
// best-ranked venues nearby. Every venue carries a derived next action (what to
// do, when it's due) so contacted leads resurface at the right time. The `today`
// feed is the cross-show list of everything actionable right now.
export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const nowMs = now.getTime();
  const shows = await prisma.show.findMany({
    where: { artistId: artist.id, status: "CONFIRMED", date: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } },
    orderBy: { date: "asc" },
    select: { id: true, venueName: true, city: true, state: true, date: true, dayOfWeek: true },
  });

  const venues = await prisma.venue.findMany({
    where: {
      artistId: artist.id,
      optedOut: false,
      worklistDismissedAt: null,
      nearestShowId: { in: shows.map((s) => s.id) },
    },
    select: {
      id: true, name: true, city: true, state: true, venueType: true,
      phone: true, email: true, decisionMakerEmail: true, decisionMakerName: true,
      leadTier: true, leadScore: true, leadReason: true, distanceMiles: true,
      nearestShowId: true, snoozedUntil: true, worklistDismissedAt: true,
      outreach: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, sentAt: true } },
      calls: { orderBy: { calledAt: "desc" }, take: 1, select: { status: true, calledAt: true, callTier: true } },
      pipeline: { select: { stage: true } },
    },
  });

  const byShow = new Map<string, typeof venues>();
  for (const v of venues) {
    if (!byShow.has(v.nearestShowId!)) byShow.set(v.nearestShowId!, []);
    byShow.get(v.nearestShowId!)!.push(v);
  }

  type Card = {
    id: string; name: string; city: string; state: string; venueType: string;
    phone: string | null; email: string | null; decisionMakerName: string | null;
    leadTier: string | null; leadScore: number; leadReason: string | null; distanceMiles: number | null;
    canCall: boolean; canEmail: boolean; action: WorklistAction;
  };

  function toCard(v: (typeof venues)[number], showDate: Date): Card {
    const email = v.decisionMakerEmail ?? v.email;
    const action = deriveAction(
      {
        canCall: !!v.phone,
        canEmail: !!email,
        leadTier: v.leadTier,
        leadScore: v.leadScore,
        daysUntilShow: daysUntil(showDate, nowMs),
        lastCall: v.calls[0] ? { status: v.calls[0].status, callTier: v.calls[0].callTier, calledAt: v.calls[0].calledAt } : null,
        lastOutreach: v.outreach[0] ? { status: v.outreach[0].status, sentAt: v.outreach[0].sentAt } : null,
        pipelineStage: v.pipeline?.stage ?? null,
        snoozedUntil: v.snoozedUntil,
        dismissedAt: v.worklistDismissedAt,
      },
      nowMs
    );
    return {
      id: v.id, name: v.name, city: v.city, state: v.state, venueType: v.venueType,
      phone: v.phone, email, decisionMakerName: v.decisionMakerName,
      leadTier: v.leadTier, leadScore: v.leadScore ?? 0, leadReason: v.leadReason, distanceMiles: v.distanceMiles,
      canCall: !!v.phone, canEmail: !!email, action,
    };
  }

  const today: Array<Card & { showId: string; showName: string }> = [];

  const result = shows.map((s) => {
    const cards = (byShow.get(s.id) ?? [])
      .map((v) => toCard(v, s.date))
      .filter((c) => c.action.kind !== "DONE")
      .sort((a, b) => b.action.urgency - a.action.urgency);

    for (const c of cards) {
      if (c.action.due) today.push({ ...c, showId: s.id, showName: s.venueName });
    }

    const due = cards.filter((c) => c.action.due);
    return {
      id: s.id,
      venueName: s.venueName,
      city: s.city,
      state: s.state,
      dayOfWeek: s.dayOfWeek,
      date: s.date.toISOString().slice(0, 10),
      counts: {
        due: due.length,
        call: due.filter((c) => c.action.channel === "CALL").length,
        email: due.filter((c) => c.action.channel === "EMAIL").length,
        total: cards.length,
      },
      venues: cards.slice(0, 40),
    };
  });

  today.sort((a, b) => b.action.urgency - a.action.urgency);

  return NextResponse.json({ ok: true, today, shows: result });
}
