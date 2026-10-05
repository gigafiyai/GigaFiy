import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { daysUntil } from "@/lib/lead-ranking";
import { deriveAction, type WorklistAction } from "@/lib/worklist-engine";
import { startOfToday as getStartOfToday } from "@/lib/today";

export const dynamic = "force-dynamic";

// The self-refreshing worklist. Every venue carries a derived next action (what
// to do, when it's due) so contacted leads resurface at the right time.
//   shows    — upcoming confirmed shows, each with the ranked venues near it
//   unrouted — venues with no upcoming show nearby (past stops, home area).
//              Still worth contacting; they just rank below routed leads and
//              are pitched without the "playing nearby" hook.
//   today    — everything actionable right now across both, urgency-sorted
export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const nowMs = now.getTime();
  const shows = await prisma.show.findMany({
    where: { artistId: artist.id, status: "CONFIRMED", date: { gte: getStartOfToday(now) } },
    orderBy: { date: "asc" },
    select: { id: true, venueName: true, city: true, state: true, date: true, dayOfWeek: true },
  });
  const showById = new Map(shows.map((s) => [s.id, s]));

  const venues = await prisma.venue.findMany({
    where: { artistId: artist.id, optedOut: false, worklistDismissedAt: null },
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

  type Card = {
    id: string; name: string; city: string; state: string; venueType: string;
    phone: string | null; email: string | null; decisionMakerName: string | null;
    leadTier: string | null; leadScore: number; leadReason: string | null; distanceMiles: number | null;
    canCall: boolean; canEmail: boolean; action: WorklistAction;
  };

  function toCard(v: (typeof venues)[number], showDate: Date | null): Card {
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
      leadTier: v.leadTier, leadScore: v.leadScore ?? 0, leadReason: v.leadReason,
      // Distance is measured to the anchor show, so it only means something while that show is upcoming.
      distanceMiles: showDate ? v.distanceMiles : null,
      canCall: !!v.phone, canEmail: !!email, action,
    };
  }

  const byShow = new Map<string, Card[]>();
  const unroutedCards: Card[] = [];
  for (const v of venues) {
    const show = v.nearestShowId ? showById.get(v.nearestShowId) : undefined;
    const card = toCard(v, show?.date ?? null);
    if (card.action.kind === "DONE") continue;
    if (show) {
      if (!byShow.has(show.id)) byShow.set(show.id, []);
      byShow.get(show.id)!.push(card);
    } else {
      unroutedCards.push(card);
    }
  }

  const byUrgency = (a: Card, b: Card) => b.action.urgency - a.action.urgency;
  const today: Array<Card & { showId: string | null; showName: string }> = [];

  function summarize(cards: Card[]) {
    const due = cards.filter((c) => c.action.due);
    return {
      due: due.length,
      call: due.filter((c) => c.action.channel === "CALL").length,
      email: due.filter((c) => c.action.channel === "EMAIL").length,
      total: cards.length,
    };
  }

  const result = shows.map((s) => {
    const cards = (byShow.get(s.id) ?? []).sort(byUrgency);
    for (const c of cards) if (c.action.due) today.push({ ...c, showId: s.id, showName: s.venueName });
    return {
      id: s.id,
      venueName: s.venueName,
      city: s.city,
      state: s.state,
      dayOfWeek: s.dayOfWeek,
      date: s.date.toISOString().slice(0, 10),
      counts: summarize(cards),
      venues: cards.slice(0, 40),
    };
  });

  unroutedCards.sort(byUrgency);
  for (const c of unroutedCards) if (c.action.due) today.push({ ...c, showId: null, showName: "" });
  today.sort(byUrgency);

  return NextResponse.json({
    ok: true,
    dueTotal: today.length,
    // The full due list can run to hundreds; the client works a short daily cut.
    today: today.slice(0, 60),
    shows: result,
    unrouted: { counts: summarize(unroutedCards), venues: unroutedCards.slice(0, 40) },
  });
}
