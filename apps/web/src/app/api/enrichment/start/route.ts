import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { runEnrichment, type EnrichmentTier } from "@/lib/enrichment";

export const dynamic = "force-dynamic";

// Kicks off a server-side enrichment job. Processing runs in the background
// via a detached async chain — the response returns immediately with a jobId.
// The client polls /api/enrichment/status to track progress.
// Works on Railway (persistent Node.js process). On Vercel serverless this
// would need a queue; for the pilot Railway is the right host anyway.

export async function POST(req: NextRequest) {
  const tier = (req.nextUrl.searchParams.get("tier") ?? "free") as EnrichmentTier;

  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  // Cancel any running job for this artist + tier first.
  await prisma.enrichmentJob.updateMany({
    where: { artistId: artist.id, status: "running" },
    data: { status: "cancelled", completedAt: new Date() },
  });

  // Count shows that have venues needing enrichment.
  const shows = await prisma.show.findMany({
    where: { artistId: artist.id, status: "CONFIRMED" },
    orderBy: { date: "asc" },
    select: { id: true, city: true, state: true, venueName: true },
  });

  const job = await prisma.enrichmentJob.create({
    data: {
      artistId: artist.id,
      tier,
      status: "running",
      totalShows: shows.length,
    },
  });

  // Fire-and-forget: processJob runs without blocking the response.
  // Node.js keeps this alive as long as the event loop has pending work.
  processJob(job.id, artist.id, tier, shows).catch((err) => {
    console.error("[enrichment-job] unhandled error:", err);
    prisma.enrichmentJob
      .update({
        where: { id: job.id },
        data: { status: "error", errorMsg: err?.message ?? "unknown", completedAt: new Date() },
      })
      .catch(() => {});
  });

  return NextResponse.json({ jobId: job.id, tier, totalShows: shows.length });
}

async function processJob(
  jobId: string,
  artistId: string,
  tier: EnrichmentTier,
  shows: Array<{ id: string; city: string; state: string; venueName: string }>
) {
  let totalAttempted = 0;
  let totalEnriched = 0;
  let totalNoMatch = 0;
  let totalSkipped = 0;

  for (let i = 0; i < shows.length; i++) {
    const show = shows[i];

    // Check if job was cancelled.
    const current = await prisma.enrichmentJob.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (current?.status !== "running") break;

    await prisma.enrichmentJob.update({
      where: { id: jobId },
      data: {
        showsDone: i,
        currentShow: `${show.city}, ${show.state}`,
      },
    });

    // Process this show's venues in batches of 25.
    const where = {
      nearestShowId: show.id,
      OR: [
        { decisionMakerEmail: null },
        ...(tier === "premium" ? [{ decisionMakerName: null }] : []),
      ],
    };

    let lastRemaining = Infinity;

    while (true) {
      // Re-check cancellation each batch.
      const check = await prisma.enrichmentJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      });
      if (check?.status !== "running") return;

      const candidates = await prisma.venue.findMany({
        where,
        select: {
          id: true, name: true, city: true, state: true,
          venueType: true, website: true,
          decisionMakerName: true, decisionMakerEmail: true,
          decisionMakerPhone: true, decisionMakerRole: true,
          email: true, instagramHandle: true, facebookUrl: true, narrative: true,
        },
        take: 25,
        orderBy: { createdAt: "asc" },
      });

      if (candidates.length === 0) break;

      const CONCURRENCY = tier === "premium" ? 1 : tier === "deep" ? 2 : 4;
      for (let c = 0; c < candidates.length; c += CONCURRENCY) {
        const batch = candidates.slice(c, c + CONCURRENCY);
        await Promise.all(
          batch.map(async (v) => {
            if (tier === "free" && !v.website) {
              totalSkipped++;
              return;
            }
            const result = await runEnrichment(
              { venueName: v.name, city: v.city, state: v.state, venueType: v.venueType, website: v.website },
              tier
            );
            const f = result.fieldsAvailable;
            const updates: Record<string, unknown> = {};
            if (f.name && !v.decisionMakerName) updates.decisionMakerName = f.name;
            if (f.email && !v.decisionMakerEmail) updates.decisionMakerEmail = f.email;
            if (f.email && !v.email) updates.email = f.email;
            if (f.phone && !v.decisionMakerPhone) updates.decisionMakerPhone = f.phone;
            if (f.title && !v.decisionMakerRole?.toLowerCase().includes(f.title.toLowerCase())) {
              updates.decisionMakerRole = f.title;
            }
            const intel = result.intelligence;
            if (intel) {
              if (intel.rawAboutText) updates.rawAboutText = intel.rawAboutText;
              if (intel.instagramHandle && !v.instagramHandle) updates.instagramHandle = intel.instagramHandle;
              if (intel.facebookUrl && !v.facebookUrl) updates.facebookUrl = intel.facebookUrl;
              if (intel.analysis) {
                const a = intel.analysis;
                if (a.narrative) updates.narrative = a.narrative;
                if (a.hostsLiveMusic !== null) updates.hostsLiveMusic = a.hostsLiveMusic;
                if (a.genresHosted.length > 0) updates.genresHosted = a.genresHosted;
                if (a.cuisine) updates.cuisine = a.cuisine;
                if (a.vibe.length > 0) updates.vibe = a.vibe;
                if (a.priceRange) updates.priceRange = a.priceRange;
                if (a.foundedYear) updates.foundedYear = a.foundedYear;
                if (a.pastArtists.length > 0) updates.pastArtists = a.pastArtists;
                updates.narrativeFetchedAt = new Date();
              }
            }
            if (Object.keys(updates).length > 0) {
              await prisma.venue.update({
                where: { id: v.id },
                data: updates as Parameters<typeof prisma.venue.update>[0]["data"],
              });
              if (f.email) totalEnriched++;
              else totalNoMatch++;
            } else {
              totalNoMatch++;
            }
            totalAttempted++;
          })
        );
      }

      const remaining = await prisma.venue.count({ where });
      await prisma.enrichmentJob.update({
        where: { id: jobId },
        data: {
          attempted: totalAttempted,
          enriched: totalEnriched,
          noMatch: totalNoMatch,
          skipped: totalSkipped,
        },
      });

      if (remaining === 0) break;
      if (candidates.length > 0 && totalEnriched === 0 && candidates.every((v) => !v.website)) break;
      if (remaining >= lastRemaining) break;
      lastRemaining = remaining;
    }

    await prisma.enrichmentJob.update({
      where: { id: jobId },
      data: { showsDone: i + 1 },
    });
  }

  await prisma.enrichmentJob.update({
    where: { id: jobId },
    data: {
      status: "completed",
      completedAt: new Date(),
      attempted: totalAttempted,
      enriched: totalEnriched,
      noMatch: totalNoMatch,
      skipped: totalSkipped,
      showsDone: shows.length,
      currentShow: null,
    },
  });
}
