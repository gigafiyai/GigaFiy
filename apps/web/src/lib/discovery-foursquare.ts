// Foursquare Places API v3 venue discovery.
// Free tier: 5,000 calls/day. No credit card required.
// Docs: https://docs.foursquare.com/developer/reference/place-search
//
// Foursquare's index is genuinely different from Google Places — it has
// stronger coverage of small independent bars and music venues, especially
// those without a Google Business profile.

import type { VenueType } from "@gigify/db";

const BASE_URL = "https://api.foursquare.com/v3/places/search";

// Foursquare category IDs that map to our venue types.
// Full list: https://docs.foursquare.com/data-products/docs/categories
const CATEGORY_IDS = [
  "13003", // Bar
  "13009", // Brewery
  "13010", // Cocktail Bar
  "13017", // Gay Bar
  "13019", // Hotel Bar
  "13020", // Jazz Bar
  "13022", // Lounge
  "13024", // Piano Bar
  "13025", // Pub
  "13029", // Sports Bar
  "13030", // Whisky Bar
  "10000", // Arts and Entertainment
  "10002", // Performing Arts Venue
  "10004", // Concert Hall
  "10005", // Jazz Club
  "10006", // Music Venue
  "10056", // Theater
  "13065", // Restaurant (broader catch)
  "13032", // Café / Coffee Shop
].join(",");

type FoursquarePlace = {
  fsq_id: string;
  name: string;
  location?: {
    formatted_address?: string;
    locality?: string;
    region?: string;
    postcode?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  geocodes?: {
    main?: { latitude: number; longitude: number };
    roof?: { latitude: number; longitude: number };
  };
  categories?: Array<{ id: number; name: string }>;
  tel?: string;
  website?: string;
  social_media?: { facebook_id?: string; instagram?: string };
};

type SearchResponse = {
  results?: FoursquarePlace[];
};

function inferVenueType(categories: Array<{ id: number; name: string }> | undefined): VenueType {
  if (!categories?.length) return "OTHER";
  for (const c of categories) {
    const id = String(c.id);
    const name = c.name.toLowerCase();
    if (
      id === "10006" || id === "10004" || id === "10005" ||
      name.includes("music") || name.includes("concert") || name.includes("jazz")
    ) return "MUSIC_CLUB";
    if (
      id === "10002" || id === "10056" ||
      name.includes("theater") || name.includes("theatre") || name.includes("performing")
    ) return "ARTS_CENTER";
    if (
      id.startsWith("1300") ||
      name.includes("bar") || name.includes("pub") || name.includes("brewery") ||
      name.includes("lounge") || name.includes("tavern")
    ) return "BAR";
  }
  return "RESTAURANT";
}

export type FoursquareCandidate = {
  source: "foursquare";
  externalId: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  instagramHandle: string | null;
  venueType: VenueType;
};

export async function discoverVenuesViaFoursquare(opts: {
  center: { lat: number; lng: number };
  radiusMiles: number;
  apiKey: string;
}): Promise<FoursquareCandidate[]> {
  const radiusMeters = Math.round(
    Math.min(opts.radiusMiles * 1609.34, 100000) // Foursquare max is 100km
  );

  const url = new URL(BASE_URL);
  url.searchParams.set("ll", `${opts.center.lat},${opts.center.lng}`);
  url.searchParams.set("radius", String(radiusMeters));
  url.searchParams.set("categories", CATEGORY_IDS);
  url.searchParams.set("limit", "50"); // Foursquare max per call
  url.searchParams.set("fields", "fsq_id,name,location,geocodes,categories,tel,website,social_media");

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: opts.apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Foursquare error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = (await res.json()) as SearchResponse;
  const out: FoursquareCandidate[] = [];

  for (const p of data.results ?? []) {
    const coords = p.geocodes?.main ?? p.geocodes?.roof;
    const lat = coords?.latitude ?? p.location?.lat;
    const lng = coords?.longitude ?? p.location?.lng;
    if (!lat || !lng || !p.name) continue;

    const ig = p.social_media?.instagram
      ? `@${p.social_media.instagram.replace(/^@/, "")}`
      : null;

    out.push({
      source: "foursquare",
      externalId: p.fsq_id,
      name: p.name,
      address: p.location?.formatted_address ?? p.location?.address ?? null,
      city: p.location?.locality ?? null,
      state: p.location?.region ?? null,
      lat,
      lng,
      phone: p.tel ?? null,
      website: p.website ?? null,
      instagramHandle: ig,
      venueType: inferVenueType(p.categories),
    });
  }

  return out;
}
