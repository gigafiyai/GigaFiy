import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import {
  searchNearbyVenues,
  placeToDiscoveredVenue,
  haversineMiles,
  isExcludedVenue,
  inferDecisionMakerRole,
} from "@/lib/discovery";
import { discoverVenuesViaSetlistFm } from "@/lib/discovery-setlist";
import { discoverVenuesViaOSM } from "@/lib/discovery-osm";
import { discoverVenuesViaFoursquare } from "@/lib/discovery-foursquare";
import { dedupeCandidates, type Candidate } from "@/lib/dedupe";
import { buildQueryRing } from "@/lib/geo-ring";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const googleKey = process.env.GOOGLE_PLACES_API_KEY;
  const setlistKey = process.env.SETLIST_FM_API_KEY;
  const foursquareKey = process.env.FOURSQUARE_API_KEY;
  if (!googleKey) {
    return NextResponse.json(
      { error: "GOOGLE_PLACES_API_KEY not set in .env" },
      { status: 500 }
    );
  }

  const { showId, radiusMiles } = (await req.json()) as {
    showId?: string;
    radiusMiles?: number;
  };
  if (!showId) {
    return NextResponse.json({ error: "showId required" }, { status: 400 });
  }
  const radius = Math.min(Math.max(radiusMiles ?? 25, 5), 31); // Google caps at 50km

  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: { artist: true },
  });
  if (!show) {
    return NextResponse.json({ error: "show not found" }, { status: 404 });
  }

  const center = { lat: show.lat, lng: show.lng };

  // Build a geo-ring of query points so APIs that cap at 20 results/query
  // give us coverage across the full radius, not just the center.
  const queryRing = buildQueryRing(center, radius, 4); // center + N/E/S/W

  // Fire all four sources in parallel.
  const sourceResults = await Promise.allSettled([
    // Google Places — queried from each ring point.
    (async () => {
      const cs: Candidate[] = [];
      await Promise.all(
        queryRing.map(async (pt) => {
          const places = await searchNearbyVenues({
            center: pt,
            radiusMiles: radius * 0.55, // smaller radius per point avoids re-querying
            apiKey: googleKey,
          });
          for (const place of places) {
            const d = placeToDiscoveredVenue(place, center);
            if (!d) continue;
            cs.push({
              source: "google_places",
              externalId: d.googlePlaceId,
              name: d.name,
              address: d.address,
              city: d.city,
              state: d.state,
              lat: d.lat,
              lng: d.lng,
              phone: d.phone,
              website: d.website,
              venueType: d.venueType,
              decisionMakerRole: d.decisionMakerRole,
            });
          }
        })
      );
      return cs;
    })(),

    // Setlist.fm — city-level, no geo ring needed.
    (async () => {
      if (!setlistKey) return [] as Candidate[];
      const setlistVenues = await discoverVenuesViaSetlistFm({
        city: show.city,
        state: show.state,
        apiKey: setlistKey,
      });
      return setlistVenues.map<Candidate>((v) => ({
        source: "setlist_fm",
        externalId: v.externalId,
        name: v.name,
        address: null,
        city: v.city,
        state: v.state,
        lat: v.lat,
        lng: v.lng,
        phone: null,
        website: null,
        venueType: v.venueType,
        decisionMakerRole: inferDecisionMakerRole(v.venueType),
        signals: v.signals,
      }));
    })(),

    // OpenStreetMap — also queried from the ring for maximum coverage.
    (async () => {
      const all: Candidate[] = [];
      await Promise.all(
        queryRing.map(async (pt) => {
          const osmVenues = await discoverVenuesViaOSM({
            center: pt,
            radiusMiles: radius * 0.55,
          });
          for (const v of osmVenues) {
            all.push({
              source: "openstreetmap",
              externalId: v.externalId,
              name: v.name,
              address: v.address,
              city: v.city,
              state: v.state,
              lat: v.lat,
              lng: v.lng,
              phone: v.phone,
              website: v.website,
              venueType: v.venueType,
              decisionMakerRole: inferDecisionMakerRole(v.venueType),
            });
          }
        })
      );
      return all;
    })(),

    // Foursquare — queried from the ring.
    (async () => {
      if (!foursquareKey) return [] as Candidate[];
      const all: Candidate[] = [];
      await Promise.all(
        queryRing.map(async (pt) => {
          const fsqVenues = await discoverVenuesViaFoursquare({
            center: pt,
            radiusMiles: radius * 0.55,
            apiKey: foursquareKey,
          });
          for (const v of fsqVenues) {
            all.push({
              source: "foursquare",
              externalId: v.externalId,
              name: v.name,
              address: v.address,
              city: v.city,
              state: v.state,
              lat: v.lat,
              lng: v.lng,
              phone: v.phone,
              website: v.website,
              venueType: v.venueType,
              decisionMakerRole: inferDecisionMakerRole(v.venueType),
            });
          }
        })
      );
      return all;
    })(),
  ]);

  const errors: Record<string, string> = {};
  const allCandidates: Candidate[] = [];
  const sourceCounts: Record<string, number> = {
    google_places: 0,
    setlist_fm: 0,
    openstreetmap: 0,
    foursquare: 0,
  };
  const sourceNames = ["google_places", "setlist_fm", "openstreetmap", "foursquare"] as const;
  sourceResults.forEach((r, i) => {
    const name = sourceNames[i];
    if (r.status === "fulfilled") {
      sourceCounts[name] = r.value.length;
      allCandidates.push(...r.value);
    } else {
      errors[name] = r.reason instanceof Error ? r.reason.message : String(r.reason);
    }
  });

  // Dedupe across sources.
  const deduped = dedupeCandidates(allCandidates);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const c of deduped) {
    if (isExcludedVenue(c.name)) {
      skipped++;
      continue;
    }
    const distance = haversineMiles(center, { lat: c.lat, lng: c.lng });
    const distanceMiles = Math.round(distance * 10) / 10;
    // Drop anything past the radius (OSM and Setlist.fm can spill over).
    if (distanceMiles > radius * 1.05) {
      skipped++;
      continue;
    }
    // Skip the show's own venue.
    if (
      c.name.toLowerCase() === show.venueName.toLowerCase() ||
      distanceMiles < 0.05
    ) {
      skipped++;
      continue;
    }

    // Existing-venue lookup: by googlePlaceId first (most precise), then by
    // name+rough-location to catch venues discovered via Setlist.fm or OSM
    // that already exist under their Google ID.
    let existing = c.externalId && c.source === "google_places"
      ? await prisma.venue.findFirst({
          where: { googlePlaceId: c.externalId },
          include: { nearestShow: true },
        })
      : null;
    if (!existing) {
      existing = await prisma.venue.findFirst({
        where: {
          name: { equals: c.name, mode: "insensitive" },
          city: { equals: c.city ?? show.city, mode: "insensitive" },
        },
        include: { nearestShow: true },
      });
    }

    if (existing) {
      const currentDistance = existing.nearestShow
        ? haversineMiles(
            { lat: existing.lat, lng: existing.lng },
            { lat: existing.nearestShow.lat, lng: existing.nearestShow.lng }
          )
        : Infinity;
      const updates: Record<string, unknown> = {};
      if (distanceMiles < currentDistance) {
        updates.nearestShowId = show.id;
        updates.distanceMiles = distanceMiles;
      }
      // Fill blanks from new candidate.
      if (!existing.phone && c.phone) updates.phone = c.phone;
      if (!existing.website && c.website) updates.website = c.website;
      if (c.source === "google_places" && !existing.googlePlaceId) {
        updates.googlePlaceId = c.externalId;
      }
      // Propagate Setlist.fm's hostsLiveMusic signal to existing venues.
      if (c.signals?.hostsLiveMusic && !existing.hostsLiveMusic) {
        updates.hostsLiveMusic = true;
      }
      if (Object.keys(updates).length > 0) {
        await prisma.venue.update({
          where: { id: existing.id },
          data: updates as Parameters<typeof prisma.venue.update>[0]["data"],
        });
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    // Build the multi-source label for the `source` column.
    const sourceLabel = c.sources.join("+");

    // Create venue + queued outreach + queued pipeline atomically.
    await prisma.$transaction(async (tx) => {
      const venue = await tx.venue.create({
        data: {
          name: c.name,
          city: c.city ?? show.city,
          state: c.state ?? show.state,
          address: c.address ?? `${c.city ?? show.city}, ${c.state ?? show.state}`,
          lat: c.lat,
          lng: c.lng,
          phone: c.phone,
          website: c.website,
          venueType: c.venueType,
          decisionMakerRole: c.decisionMakerRole ?? inferDecisionMakerRole(c.venueType),
          artistId: show.artistId,
          nearestShowId: show.id,
          distanceMiles,
          googlePlaceId: c.source === "google_places" ? c.externalId : null,
          source: sourceLabel,
          hostsLiveMusic: c.signals?.hostsLiveMusic ?? null,
        },
      });

      await tx.outreach.create({
        data: {
          venueId: venue.id,
          artistId: show.artistId,
          channel: "EMAIL",
          status: "QUEUED",
          variant: "a",
        },
      });

      await tx.pipeline.create({
        data: {
          venueId: venue.id,
          artistId: show.artistId,
          stage: "QUEUED",
        },
      });
    });

    inserted++;
  }

  return NextResponse.json({
    showId: show.id,
    radius,
    sourceCounts,
    sourceErrors: errors,
    totalCandidates: allCandidates.length,
    dedupedCandidates: deduped.length,
    inserted,
    updated,
    skipped,
  });
}
