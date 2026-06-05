import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { quoteCampaign, debitGems, planCampaign, sendingSubdomains, type CampaignChannel } from "@/lib/gems";
import { outreachPriority, daysUntil } from "@/lib/lead-ranking";

export const dynamic = "force-dynamic";

// Reputation-safe per-day ceilings for a campaign (across rotated subdomains).
const DEFAULT_PER_DAY: Record<CampaignChannel, number> = { email: 25, call: 20 };

// Run a campaign over a selected set of venues.
//   POST { venueIds, channel, perDayCap?, startDate? }
// Orders venues by proximity-to-gig priority, debits gems, and schedules the
// sends spread across days + rotated sending subdomains.
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    venueIds?: string[];
    channel?: CampaignChannel;
    perDayCap?: number;
    startDate?: string;
  };
  const channel: CampaignChannel = body.channel === "call" ? "call" : "email";
  const venueIds = Array.isArray(body.venueIds) ? [...new Set(body.venueIds)] : [];
  if (venueIds.length === 0) {
    return NextResponse.json({ error: "venueIds required" }, { status: 400 });
  }

  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  // Order the selected venues by outreach priority (proximity to gig + tier).
  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds } },
    select: { id: true, leadScore: true, leadTier: true, nearestShow: { select: { date: true } } },
  });
  const now = Date.now();
  const rankedVenueIds = venues
    .map((v) => ({
      id: v.id,
      priority: outreachPriority({
        leadScore: v.leadScore,
        leadTier: v.leadTier,
        daysUntilShow: daysUntil(v.nearestShow?.date, now),
      }),
    }))
    .sort((a, b) => b.priority - a.priority)
    .map((v) => v.id);

  if (rankedVenueIds.length === 0) {
    return NextResponse.json({ error: "no matching venues" }, { status: 400 });
  }

  // Quote + charge.
  const quote = quoteCampaign(rankedVenueIds.length, channel);
  const perDayCap = Math.max(1, body.perDayCap ?? DEFAULT_PER_DAY[channel]);
  const subdomains = channel === "email" ? sendingSubdomains() : [];
  const startDate = body.startDate ? new Date(body.startDate) : new Date();

  const plan = planCampaign({ rankedVenueIds, perDayCap, subdomains, startDate });

  // Create the campaign + items, then debit gems tied to it. If the debit fails
  // (insufficient balance), roll the campaign back.
  const campaign = await prisma.campaign.create({
    data: {
      artistId: artist.id,
      channel,
      status: "scheduled",
      venueCount: rankedVenueIds.length,
      gemCost: quote.gemCost,
      daysSpread: plan.daysSpread,
      perDayCap,
      subdomains,
      items: {
        create: plan.items.map((it) => ({
          venueId: it.venueId,
          rank: it.rank,
          scheduledFor: it.scheduledFor,
          sendingDomain: it.sendingDomain,
        })),
      },
    },
  });

  const debited = await debitGems(artist.id, quote.gemCost, "campaign", campaign.id);
  if (debited === null) {
    // Roll back — can't afford it.
    await prisma.campaignItem.deleteMany({ where: { campaignId: campaign.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    return NextResponse.json({ error: "insufficient gems", needed: quote.gemCost }, { status: 402 });
  }

  return NextResponse.json({
    ok: true,
    campaignId: campaign.id,
    channel,
    venueCount: campaign.venueCount,
    gemCost: campaign.gemCost,
    daysSpread: campaign.daysSpread,
    perDayCap,
    subdomains,
    balanceAfter: debited,
  });
}
