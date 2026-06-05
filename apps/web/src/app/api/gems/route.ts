import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { GEM_PACKS, GEM_USD } from "@/lib/gems";

export const dynamic = "force-dynamic";

// Gem balance, purchasable packs, and recent ledger activity for the UI.
export async function GET() {
  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const recent = await prisma.gemTransaction.findMany({
    where: { artistId: artist.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { delta: true, reason: true, createdAt: true, balanceAfter: true },
  });

  return NextResponse.json({
    ok: true,
    balance: artist.gemBalance,
    gemUsd: GEM_USD,
    packs: GEM_PACKS.map((p, i) => ({ index: i, ...p })),
    recent: recent.map((r) => ({
      delta: r.delta, reason: r.reason, balanceAfter: r.balanceAfter, at: r.createdAt.toISOString(),
    })),
  });
}
