import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// List recent campaigns with their item-status breakdown — powers the
// "campaigns in flight" progress view.
export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const campaigns = await prisma.campaign.findMany({
    where: { artistId: artist.id },
    orderBy: { startedAt: "desc" },
    take: 25,
  });
  const ids = campaigns.map((c) => c.id);

  const grouped = ids.length
    ? await prisma.campaignItem.groupBy({
        by: ["campaignId", "status"],
        where: { campaignId: { in: ids } },
        _count: true,
      })
    : [];

  const counts = new Map<string, Record<string, number>>();
  for (const g of grouped) {
    const m = counts.get(g.campaignId) ?? {};
    m[g.status] = g._count;
    counts.set(g.campaignId, m);
  }

  return NextResponse.json({
    ok: true,
    campaigns: campaigns.map((c) => {
      const m = counts.get(c.id) ?? {};
      const sent = m.sent ?? 0, failed = m.failed ?? 0, skipped = m.skipped ?? 0, pending = m.pending ?? 0;
      return {
        id: c.id,
        channel: c.channel,
        status: c.status,
        venueCount: c.venueCount,
        gemCost: c.gemCost,
        daysSpread: c.daysSpread,
        startedAt: c.startedAt.toISOString(),
        completedAt: c.completedAt?.toISOString() ?? null,
        counts: { sent, failed, skipped, pending },
      };
    }),
  });
}
