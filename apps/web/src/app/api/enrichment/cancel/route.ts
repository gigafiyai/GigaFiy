import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

export async function POST() {
  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ ok: false });

  await prisma.enrichmentJob.updateMany({
    where: { artistId: artist.id, status: "running" },
    data: { status: "cancelled", completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
