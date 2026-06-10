import { NextRequest, NextResponse } from "next/server";
import { prisma, Prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { runEnrichment, type EnrichmentTier } from "@/lib/enrichment";

export const dynamic = "force-dynamic";

// Kicks off a server-side enrichment job. Processing runs in the background
// via a detached async chain — the response returns immediately with a jobId.
// The client polls /api/enrichment/status to track progress.
// Works on Railway (persistent Node.js process). On Vercel serverless this
// would need a queue; for the pilot Railway is the right host anyway.

export async function POST(req: NextRequest) {
  const tier = (req.nextUrl.searchParams.get("tier") ?? "free") as EnrichmentTier;

  const artist = await getAuthedArtist();
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

  // Fire-and-forget: full pipeline runs in background.
  // Phase order: prune → repair → enrich → mine_reviews → score → done
  runFullPipeline(job.id, artist.id, tier, shows).catch((err) => {
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

    // Per-tier "checked off" logic: once a venue is processed at a tier, it
    // gets a tier-specific timestamp and is permanently skipped on re-runs of
    // that tier. This is what makes re-enrichment fast — no re-processing
    // venues already fully handled. A different (higher) tier still processes
    // them because each tier has its own flag.
    const tierFlag =
      tier === "free" ? "freeEnrichedAt" :
      tier === "deep" ? "deepEnrichedAt" :
      "premiumEnrichedAt";

    const where: Prisma.VenueWhereInput = {
      nearestShowId: show.id,
      AND: [
        // Not yet processed at THIS tier
        { [tierFlag]: null },
        // Still missing a real email (already-enriched venues are done)
        { decisionMakerEmail: null },
        { email: null },
        // Deep tier needs a website to scrape (it executes JS on a page).
        // Free tier does NOT require one — it backfills the website + phone from
        // Google Places by name+city first (this is what fixes the Setlist.fm /
        // OSM venues that arrived with no website). Premium searches by name too.
        ...(tier === "deep" ? [{ website: { not: null } }] : []),
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
          venueType: true, website: true, phone: true, googlePlaceId: true,
          decisionMakerName: true, decisionMakerEmail: true,
          decisionMakerPhone: true, decisionMakerRole: true,
          email: true, instagramHandle: true, facebookUrl: true, narrative: true,
        },
        take: 25,
        orderBy: { createdAt: "asc" },
      });

      if (candidates.length === 0) break;

      const CONCURRENCY = tier === "premium" ? 1 : tier === "deep" ? 3 : 12; // free: 12 parallel fetches
      for (let c = 0; c < candidates.length; c += CONCURRENCY) {
        const batch = candidates.slice(c, c + CONCURRENCY);
        await Promise.all(
          batch.map(async (v) => {
            // Deep tier needs a website; free tier backfills it from Places.
            if (tier === "deep" && !v.website) {
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
            // Backfilled-from-Places fields — fill the venue's own website/phone/placeId.
            if (f.website && !v.website) updates.website = f.website;
            if (f.phone && !v.phone) updates.phone = f.phone;
            if (f.googlePlaceId && !v.googlePlaceId) updates.googlePlaceId = f.googlePlaceId;
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
            // Stamp BOTH the general timestamp and the per-tier completion flag.
            // The per-tier flag checks this venue off so re-runs of this tier skip it.
            const now = new Date();
            updates.enrichAttemptedAt = now;
            updates[tierFlag] = now;
            await prisma.venue.update({
              where: { id: v.id },
              data: updates as Parameters<typeof prisma.venue.update>[0]["data"],
            });
            if (f.email) totalEnriched++;
            else totalNoMatch++;
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
      phase: "done",
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

// ── Full pipeline orchestrator ────────────────────────────────────────────────
// Runs: prune → repair → enrich → mine_reviews → score
// Each phase updates job.phase so the client can light up the roadmap.

async function runFullPipeline(
  jobId: string,
  artistId: string,
  tier: EnrichmentTier,
  shows: Array<{ id: string; city: string; state: string; venueName: string }>
) {
  async function setPhase(phase: string) {
    await prisma.enrichmentJob.update({ where: { id: jobId }, data: { phase } });
  }

  async function checkCancelled(): Promise<boolean> {
    const j = await prisma.enrichmentJob.findUnique({ where: { id: jobId }, select: { status: true } });
    return j?.status !== "running";
  }

  try {
    // ── Phase 1: Prune ──────────────────────────────────────────────────
    await setPhase("prune");
    const { isExcludedVenue } = await import("@/lib/discovery");
    const venues = await prisma.venue.findMany({ where: { artistId }, select: { id: true, name: true } });
    const doomed = venues.filter((v) => isExcludedVenue(v.name)).map((v) => v.id);
    if (doomed.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.survey.deleteMany({ where: { venueId: { in: doomed } } });
        await tx.pipeline.deleteMany({ where: { venueId: { in: doomed } } });
        await tx.call.deleteMany({ where: { venueId: { in: doomed } } });
        await tx.outreach.deleteMany({ where: { venueId: { in: doomed } } });
        await tx.venue.deleteMany({ where: { id: { in: doomed } } });
      });
    }
    await prisma.enrichmentJob.update({ where: { id: jobId }, data: { pruned: doomed.length } });
    if (await checkCancelled()) return;

    // ── Phase 2: Repair ─────────────────────────────────────────────────
    await setPhase("repair");
    const { parseCityFromAddress, parseStateFromAddress, reclassifyByName } = await import("@/lib/discovery");
    const { isJunkEmail } = await import("@/lib/web-scrape");
    const allVenues = await prisma.venue.findMany({
      where: { artistId },
      select: { id: true, name: true, city: true, state: true, address: true, venueType: true, decisionMakerRole: true, decisionMakerEmail: true, email: true },
    });
    let repaired = 0;
    for (const v of allVenues) {
      const u: Record<string, unknown> = {};
      const pc = parseCityFromAddress(v.address);
      if (pc && pc !== v.city) u.city = pc;
      const ps = parseStateFromAddress(v.address);
      if (ps && ps !== v.state) u.state = ps;
      const nt = reclassifyByName(v.name, v.venueType);
      if (nt !== v.venueType) { u.venueType = nt; }
      if (v.decisionMakerEmail && isJunkEmail(v.decisionMakerEmail)) u.decisionMakerEmail = null;
      if (v.email && isJunkEmail(v.email)) u.email = null;
      if (Object.keys(u).length > 0) {
        await prisma.venue.update({ where: { id: v.id }, data: u as Parameters<typeof prisma.venue.update>[0]["data"] });
        repaired++;
      }
    }
    await prisma.enrichmentJob.update({ where: { id: jobId }, data: { repaired } });
    if (await checkCancelled()) return;

    // ── Phase 3: Enrich ─────────────────────────────────────────────────
    await setPhase("enrich");
    await processJob(jobId, artistId, tier, shows);
    if (await checkCancelled()) return;

    // ── Phase 4: Mine Reviews ───────────────────────────────────────────
    await setPhase("mine_reviews");
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (apiKey) {
      const MUSIC_PATTERNS = [/live music/i,/acoustic/i,/open mic/i,/live band/i,/performer/i,/\bband\b/i,/jazz/i,/folk/i,/blues/i,/indie/i,/concert/i];
      const PRIVATE_PATTERNS = [/private event/i,/private party/i,/buyout/i,/corporate event/i,/wedding/i];
      // Only mine venues not already mined — reviewsMinedAt checks them off.
      const reviewCandidates = await prisma.venue.findMany({
        where: { artistId, googlePlaceId: { not: null }, reviewsMinedAt: null },
        select: { id: true, googlePlaceId: true },
        take: 200,
      });
      let reviewsMined = 0;
      for (const rv of reviewCandidates) {
        try {
          const res = await fetch(`https://places.googleapis.com/v1/places/${rv.googlePlaceId}`, {
            headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "reviews,priceLevel" },
          });
          const ud: Record<string, unknown> = { reviewsMinedAt: new Date() };
          if (res.ok) {
            const data = await res.json() as { reviews?: Array<{ text?: { text?: string } }>; priceLevel?: string };
            const text = (data.reviews ?? []).map((r) => r.text?.text ?? "").join(" ");
            if (text) {
              ud.hostsLiveMusic = MUSIC_PATTERNS.some((p) => p.test(text));
              if (PRIVATE_PATTERNS.some((p) => p.test(text))) ud.privateEventsFriendly = true;
            }
            if (data.priceLevel) ud.priceRange = data.priceLevel.replace("PRICE_LEVEL_", "");
          }
          await prisma.venue.update({ where: { id: rv.id }, data: ud as Parameters<typeof prisma.venue.update>[0]["data"] });
          reviewsMined++;
        } catch {}
      }
      await prisma.enrichmentJob.update({ where: { id: jobId }, data: { reviewsMined } });
    }
    if (await checkCancelled()) return;

    // ── Phase 5: Score ──────────────────────────────────────────────────
    await setPhase("score");
    const artist = await prisma.artist.findUnique({ where: { id: artistId }, select: { genre: true } });
    if (artist) {
      const { scoreVenue } = await import("@/lib/lead-score");
      const scoreVenues = await prisma.venue.findMany({
        where: { artistId },
        select: { id: true, name: true, venueType: true, hostsLiveMusic: true, genresHosted: true, vibe: true, distanceMiles: true, decisionMakerEmail: true, email: true, phone: true, narrative: true, decisionMakerName: true },
      });
      for (const sv of scoreVenues) {
        const result = scoreVenue({ name: sv.name, venueType: sv.venueType, hostsLiveMusic: sv.hostsLiveMusic, genresHosted: sv.genresHosted, vibe: sv.vibe, distanceMiles: sv.distanceMiles, hasEmail: !!(sv.decisionMakerEmail || sv.email), hasPhone: !!sv.phone, hasNarrative: !!sv.narrative, hasDecisionMakerName: !!sv.decisionMakerName, artistGenre: artist.genre });
        await prisma.venue.update({ where: { id: sv.id }, data: { leadScore: result.total, leadTier: result.tier, leadReason: result.reason } });
      }
    }

    await prisma.enrichmentJob.update({
      where: { id: jobId },
      data: { phase: "done", status: "completed", completedAt: new Date(), currentShow: null },
    });
  } catch (err) {
    await prisma.enrichmentJob.update({
      where: { id: jobId },
      data: { status: "error", errorMsg: (err as Error)?.message ?? "unknown", completedAt: new Date() },
    });
  }
}
