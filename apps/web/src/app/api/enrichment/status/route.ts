import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ job: null });

  let job = await prisma.enrichmentJob.findFirst({
    where: { artistId: artist.id },
    orderBy: { startedAt: "desc" },
  });

  if (!job) return NextResponse.json({ job: null });

  // Self-heal: if a job claims "running" but its heartbeat hasn't moved in
  // over 2 minutes, the worker process died (almost always a deploy/container
  // restart). Mark it errored so the UI unblocks and the user can restart.
  if (job.status === "running") {
    const staleMs = Date.now() - new Date(job.updatedAt).getTime();
    if (staleMs > 2 * 60 * 1000) {
      job = await prisma.enrichmentJob.update({
        where: { id: job.id },
        data: {
          status: "error",
          errorMsg: "Job stalled (worker restarted) — safe to run again",
          completedAt: new Date(),
        },
      });
    }
  }

  return NextResponse.json({
    job: {
      id: job.id,
      tier: job.tier,
      status: job.status,
      phase: job.phase,
      attempted: job.attempted,
      enriched: job.enriched,
      noMatch: job.noMatch,
      skipped: job.skipped,
      pruned: job.pruned,
      repaired: job.repaired,
      reviewsMined: job.reviewsMined,
      totalShows: job.totalShows,
      showsDone: job.showsDone,
      currentShow: job.currentShow,
      errorMsg: job.errorMsg,
      startedAt: job.startedAt.toISOString(),
      completedAt: job.completedAt?.toISOString() ?? null,
    },
  });
}
