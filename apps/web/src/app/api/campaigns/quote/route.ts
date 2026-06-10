import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { quoteCampaign, getBalance } from "@/lib/gems";
import { apiHandler } from "@/lib/api-handler";

export const dynamic = "force-dynamic";

const schema = z.object({
  venueIds: z.array(z.string()).min(1),
  channel: z.enum(["email", "call"]).optional(),
});

// Price a campaign before running it: gem cost, balance, affordability.
export const POST = apiHandler({
  schema,
  handler: async ({ venueIds, channel }) => {
    const ch = channel === "call" ? "call" : "email";
    const artist = await getAuthedArtist();
    if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

    const quote = quoteCampaign(venueIds.length, ch);
    const balance = await getBalance(artist.id);
    return { ok: true, quote, balance, canAfford: balance >= quote.gemCost, shortfall: Math.max(0, quote.gemCost - balance) };
  },
});
