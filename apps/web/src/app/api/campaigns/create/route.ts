import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { quoteCampaign, debitGems, planCampaign, sendingSubdomains, type CampaignChannel } from "@/lib/gems";
import { outreachPriority, daysUntil } from "@/lib/lead-ranking";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Reputation-safe per-day ceilings for a campaign (across rotated subdomains).
const DEFAULT_PER_DAY: Record<CampaignChannel, number> = { email: 25, call: 20 };

const Body = z.object({
  venueIds: z.array(z.string()).min(1),
  channel: z.enum(["email", "call"]).optional(),
  perDayCap: z.number().int().positive().max(200).optional(),
  startDate: z.string().optional(),
});

// Run a campaign over a selected set of venues.
//   POST { venueIds, channel, perDayCap?, startDate? }
// Orders venues by proximity-to-gig priority, debits gems, and schedules the
// sends spread across days + rotated sending subdomains.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", issues: parsed.error.issues.map((i) => i.message) }, { status: 400 });
  }
  const body = parsed.data;
  const channel: CampaignChannel = body.channel === "call" ? "call" : "email";
  const venueIds = [...new Set(body.venueIds)];

  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Order the selected venues by outreach priority — scoped to this artist so a
  // campaign can never target another tenant's venues.
  const venues = await prisma.venue.findMany({
    where: { id: { in: venueIds }, artistId: artist.id },
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

  const debited = await debitGems(artist.id, quote.gemCost, "campaign", { campaignId: campaign.id });
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
