// OpenStreetMap Overpass API venue discovery.
// Totally free, no auth, no key. Broad safety net for venues Google misses.
// Docs: https://wiki.openstreetmap.org/wiki/Overpass_API

import type { VenueType } from "@gigify/db";

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const MILES_TO_METERS = 1609.34;

// Tag → VenueType mapping. Overpass uses amenity= and shop= and others;
// we keep the query tight to high-signal venue tags.
const AMENITY_TYPE_MAP: Record<string, VenueType> = {
  bar: "BAR",
  pub: "BAR",
  biergarten: "BAR",
  nightclub: "MUSIC_CLUB",
  music_venue: "MUSIC_CLUB",
  restaurant: "RESTAURANT",
  cafe: "RESTAURANT",
  fast_food: "RESTAURANT",
  theatre: "ARTS_CENTER",
  arts_centre: "ARTS_CENTER",
  community_centre: "ARTS_CENTER",
  social_centre: "ARTS_CENTER",
  marketplace: "FARMERS_MARKET",
};

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OsmElement[];
};

export type OsmDiscoveryCandidate = {
  source: "openstreetmap";
  externalId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  venueType: VenueType;
};

function inferVenueType(tags: Record<string, string>): VenueType | null {
  const amenity = tags.amenity?.toLowerCase();
  if (amenity && AMENITY_TYPE_MAP[amenity]) return AMENITY_TYPE_MAP[amenity];
  if (tags.tourism === "attraction" || tags.tourism === "museum") return "ARTS_CENTER";
  if (tags.craft === "brewery" || tags.shop === "brewery" || tags.industrial === "brewery") return "BAR";
  return null;
}

function buildAddress(tags: Record<string, string>): string | null {
  const num = tags["addr:housenumber"];
  const street = tags["addr:street"];
  const city = tags["addr:city"];
  const state = tags["addr:state"];
  const zip = tags["addr:postcode"];
  const parts = [
    [num, street].filter(Boolean).join(" "),
    city,
    [state, zip].filter(Boolean).join(" "),
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

export async function discoverVenuesViaOSM(opts: {
  center: { lat: number; lng: number };
  radiusMiles: number;
}): Promise<OsmDiscoveryCandidate[]> {
  const radiusMeters = Math.round(opts.radiusMiles * MILES_TO_METERS);
  const { lat, lng } = opts.center;

  // Single Overpass query gathering all relevant amenity tags in one round-trip.
  // Use `nwr` (node/way/relation) to capture all geometry types.
  const tagFilters = Object.keys(AMENITY_TYPE_MAP)
    .map((amenity) => `nwr["amenity"="${amenity}"](around:${radiusMeters},${lat},${lng});`)
    .join("\n  ");
  const extras = [
    `nwr["tourism"="museum"](around:${radiusMeters},${lat},${lng});`,
    `nwr["craft"="brewery"](around:${radiusMeters},${lat},${lng});`,
  ].join("\n  ");

  const query = `[out:json][timeout:25];
(
  ${tagFilters}
  ${extras}
);
out center tags;`;

  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
  });

  if (!res.ok) {
    throw new Error(`OSM Overpass error ${res.status}: ${await res.text().then((t) => t.slice(0, 200))}`);
  }

  const data = (await res.json()) as OverpassResponse;
  const out: OsmDiscoveryCandidate[] = [];

  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    if (!tags.name) continue; // skip un-named entries

    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (elLat == null || elLng == null) continue;

    const venueType = inferVenueType(tags) ?? "OTHER";

    out.push({
      source: "openstreetmap",
      externalId: `${el.type}/${el.id}`,
      name: tags.name,
      address: buildAddress(tags),
      city: tags["addr:city"] ?? null,
      state: tags["addr:state"] ?? null,
      lat: elLat,
      lng: elLng,
      phone: tags.phone ?? tags["contact:phone"] ?? null,
      website: tags.website ?? tags["contact:website"] ?? null,
      venueType,
    });
  }

  return out;
}
