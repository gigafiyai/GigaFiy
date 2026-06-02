import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Mine Google Places reviews for live music signals.
// Uses the existing GOOGLE_PLACES_API_KEY — no extra cost beyond Places API
// calls (5 reviews per place, free tier covers this).
//
// Specifically looks for reviews mentioning live music, acoustic sets,
// bands, performers — then updates hostsLiveMusic and leadScore.

const MUSIC_PATTERNS = [
  /live music/i, /acoustic/i, /open mic/i, /live band/i, /live entertainment/i,
  /performer/i, /musician/i, /singer/i, /\bband\b/i, /jazz/i, /folk/i,
  /blues/i, /indie/i, /bluegrass/i, /americana/i, /concert/i,
  /listening\s+room/i, /\bset\b.*music/i, /music\s+night/i,
];

const PRIVATE_EVENT_PATTERNS = [
  /private event/i, /private party/i, /private dining/i, /buyout/i,
  /corporate event/i, /wedding/i, /private function/i,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(text));
}

export async function POST() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GOOGLE_PLACES_API_KEY not set" }, { status: 500 });

  // Process venues that have a googlePlaceId but no hostsLiveMusic determination yet.
  const venues = await prisma.venue.findMany({
    where: {
      googlePlaceId: { not: null },
      hostsLiveMusic: null,
    },
    select: { id: true, googlePlaceId: true, venueType: true },
    take: 100,
  });

  let updated = 0;
  let liveMusicFound = 0;
  let privateEventsFound = 0;

  for (const venue of venues) {
    try {
      // Google Places Details API v1 — fetch reviews
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${venue.googlePlaceId}`,
        {
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "reviews,priceLevel,userRatingCount",
          },
        }
      );
      if (!res.ok) continue;

      const data = await res.json() as {
        reviews?: Array<{ text?: { text?: string } }>;
        priceLevel?: string;
        userRatingCount?: number;
      };

      const reviewTexts = (data.reviews ?? [])
        .map((r) => r.text?.text ?? "")
        .filter(Boolean)
        .join(" ");

      const hostsLiveMusic = reviewTexts.length > 0
        ? matchesAny(reviewTexts, MUSIC_PATTERNS)
        : null;
      const privateEventsFriendly = matchesAny(reviewTexts, PRIVATE_EVENT_PATTERNS);

      const updateData: Record<string, unknown> = {};
      if (hostsLiveMusic !== null) updateData.hostsLiveMusic = hostsLiveMusic;
      if (privateEventsFriendly) updateData.privateEventsFriendly = true;
      if (data.priceLevel) updateData.priceRange = data.priceLevel.replace("PRICE_LEVEL_", "").replace("UNSPECIFIED", "");
      if (data.userRatingCount) {
        // Store rating count as a proxy for venue size/activity.
        // We don't have a DB field for this yet, so encode in notes.
        // Future: add userRatingCount to schema.
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.venue.update({ where: { id: venue.id }, data: updateData });
        updated++;
        if (hostsLiveMusic) liveMusicFound++;
        if (privateEventsFriendly) privateEventsFound++;
      }
    } catch { /* per-venue failure — skip */ }
  }

  const remaining = await prisma.venue.count({
    where: { googlePlaceId: { not: null }, hostsLiveMusic: null },
  });

  return NextResponse.json({
    ok: true,
    processed: venues.length,
    updated,
    liveMusicFound,
    privateEventsFound,
    remaining,
  });
}
