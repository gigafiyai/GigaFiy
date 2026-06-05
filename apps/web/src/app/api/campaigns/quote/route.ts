import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { quoteCampaign, getBalance, type CampaignChannel } from "@/lib/gems";

export const dynamic = "force-dynamic";

// Price a campaign before running it. The artist picks venues + channel; we
// return the gem cost, their balance, and whether they can afford it.
//   POST { venueIds: string[], channel: "email" | "call" }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { venueIds?: string[]; channel?: CampaignChannel };
  const channel: CampaignChannel = body.channel === "call" ? "call" : "email";
  const venueIds = Array.isArray(body.venueIds) ? body.venueIds : [];
  if (venueIds.length === 0) {
    return NextResponse.json({ error: "venueIds required" }, { status: 400 });
  }

  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const quote = quoteCampaign(venueIds.length, channel);
  const balance = await getBalance(artist.id);

  return NextResponse.json({
    ok: true,
    quote,
    balance,
    canAfford: balance >= quote.gemCost,
    shortfall: Math.max(0, quote.gemCost - balance),
  });
}
