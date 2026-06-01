import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ job: null });

  const job = await prisma.enrichmentJob.findFirst({
    where: { artistId: artist.id },
    orderBy: { startedAt: "desc" },
  });

  if (!job) return NextResponse.json({ job: null });

  return NextResponse.json({
    job: {
      id: job.id,
      tier: job.tier,
      status: job.status,
      attempted: job.attempted,
      enriched: job.enriched,
      noMatch: job.noMatch,
      skipped: job.skipped,
      totalShows: job.totalShows,
      showsDone: job.showsDone,
      currentShow: job.currentShow,
      errorMsg: job.errorMsg,
      startedAt: job.startedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    },
  });
}
