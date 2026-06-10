import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function POST() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ ok: false });

  await prisma.enrichmentJob.updateMany({
    where: { artistId: artist.id, status: "running" },
    data: { status: "cancelled", completedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
