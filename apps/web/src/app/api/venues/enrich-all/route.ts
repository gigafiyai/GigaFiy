import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { runEnrichment, type EnrichmentTier } from "@/lib/enrichment";

export const dynamic = "force-dynamic";

// Batch-enriches venues missing email or named contact.
// tier=free  → website scraping only (zero per-lookup cost)
// tier=premium → Booking-Agent.io for named contacts (paid; falls back to scrape on miss)
export async function POST(req: NextRequest) {
  const tier = (req.nextUrl.searchParams.get("tier") ?? "free") as EnrichmentTier;
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 1),
    100
  );

  if (tier === "premium" && !process.env.BOOKING_AGENT_API_KEY) {
    return NextResponse.json(
      { error: "BOOKING_AGENT_API_KEY not set — pass tier=free to scrape websites" },
      { status: 500 }
    );
  }

  const showId = req.nextUrl.searchParams.get("showId");
  const where = {
    ...(showId ? { nearestShowId: showId } : {}),
    OR: [{ decisionMakerEmail: null }, ...(tier === "premium" ? [{ decisionMakerName: null }] : [])],
  };

  // Process up to `limit` candidates per call. Client loops until eligible=0.
  const candidates = await prisma.venue.findMany({
    where,
    select: {
      id: true,
      name: true,
      city: true,
      state: true,
      website: true,
      venueType: true,
      decisionMakerName: true,
      decisionMakerEmail: true,
      decisionMakerPhone: true,
      decisionMakerRole: true,
      email: true,
      instagramHandle: true,
      facebookUrl: true,
      narrative: true,
    },
    take: limit,
    orderBy: { createdAt: "asc" }, // stable order so loops don't re-process
  });

  let enriched = 0;
  let noMatch = 0;
  let skippedNoWebsite = 0;

  // Free: 4 concurrent fast fetches.
  // Deep: 2 (Playwright is RAM-heavy; more than 2 stalls the dev server).
  // Premium: 1 (respect upstream rate limits).
  const CONCURRENCY = tier === "premium" ? 1 : tier === "deep" ? 2 : 4;
  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (v) => {
        if (tier === "free" && !v.website) {
          skippedNoWebsite++;
          return;
        }
        const result = await runEnrichment(
          {
            venueName: v.name,
            city: v.city,
            state: v.state,
            venueType: v.venueType,
            website: v.website,
          },
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

        // Persist venue intelligence even when no email was found.
        const intel = result.intelligence;
        if (intel) {
          if (intel.rawAboutText) updates.rawAboutText = intel.rawAboutText;
          if (intel.instagramHandle && !v.instagramHandle)
            updates.instagramHandle = intel.instagramHandle;
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
          if (f.email) enriched++;
          else noMatch++;
        } else {
          noMatch++;
        }
      })
    );
  }

  // Eligible = how many still need processing after this batch. Client loops
  // until this hits 0 (or it stalls — same venue listed two calls in a row
  // means we should bail).
  const eligibleRemaining = await prisma.venue.count({ where });

  return NextResponse.json({
    ok: true,
    tier,
    attempted: candidates.length,
    enriched,
    noMatch,
    skippedNoWebsite,
    eligibleRemaining,
  });
}
