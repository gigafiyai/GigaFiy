// Google Places (New) venue discovery.
// Docs: https://developers.google.com/maps/documentation/places/web-service/nearby-search

import type { VenueType } from "@gigify/db";

const PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchNearby";

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.types",
  "places.primaryType",
  "places.nationalPhoneNumber",
  "places.websiteUri",
].join(",");

const INCLUDED_TYPES = [
  "bar",
  "night_club",
  "restaurant",
  "cafe",
  "community_center",
];

// Chains and fast food that will never book live music — filter these out.
const EXCLUDED_NAME_PATTERNS = [
  /chick-fil-a/i,
  /mcdonald/i,
  /starbucks/i,
  /subway/i,
  /dunkin/i,
  /burger king/i,
  /wendy'?s/i,
  /taco bell/i,
  /chipotle/i,
  /panera/i,
  /domino/i,
  /pizza hut/i,
  /papa john/i,
  /five guys/i,
  /popeyes/i,
  /dairy queen/i,
  /sonic drive/i,
  /applebee/i,
  /olive garden/i,
  /red lobster/i,
  /ihop/i,
  /denny'?s/i,
  /cracker barrel/i,
  /outback/i,
  /stew leonard/i,
  /topgolf/i,
  /casino/i,
  /plainridge/i,
];

const MAX_RADIUS_METERS = 50000; // Google's hard limit
const MILES_TO_METERS = 1609.34;

export type GooglePlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  types?: string[];
  primaryType?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
};

export type DiscoveredVenue = {
  googlePlaceId: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  venueType: VenueType;
  decisionMakerRole: string;
  distanceMiles: number;
};

// Parses "32 Quincy St, Cambridge, MA 02138, USA" → "Cambridge".
// Falls back to null if the format isn't US standard.
export function parseCityFromAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1]?.toUpperCase();
  if (last === "USA" || last === "US" || last === "UNITED STATES") parts.pop();
  if (parts.length < 2) return null;
  return parts[parts.length - 2];
}

// Parses "MA" or "MA 02138" → "MA" from the last segment before country.
export function parseStateFromAddress(addr: string | null | undefined): string | null {
  if (!addr) return null;
  const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
  const last = parts[parts.length - 1]?.toUpperCase();
  if (last === "USA" || last === "US" || last === "UNITED STATES") parts.pop();
  const tail = parts[parts.length - 1];
  if (!tail) return null;
  const m = tail.match(/\b([A-Z]{2})\b/);
  return m ? m[1].toUpperCase() : null;
}

// Heuristic re-classify based on venue name (used by the repair endpoint where
// we don't have the original Google types stored).
export function reclassifyByName(name: string, current: VenueType): VenueType {
  const lc = name.toLowerCase();
  if (/(museum|gallery|theatre|theater|cultural center|arts center|opera house|concert hall|amphitheat)/i.test(lc)) {
    return "ARTS_CENTER";
  }
  if (/(brewery|brewing|brew co|distillery|winery|taproom|tavern|pub|bar & grill)/i.test(lc) && current === "RESTAURANT") {
    return "BAR";
  }
  if (/farmers market|farmer's market/i.test(lc)) return "FARMERS_MARKET";
  if (/porchfest|festival/i.test(lc)) return "FESTIVAL";
  return current;
}

export function haversineMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 3958.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function classifyVenueType(place: GooglePlace): VenueType {
  const types = new Set([place.primaryType, ...(place.types ?? [])].filter(Boolean) as string[]);
  if (types.has("night_club") || types.has("live_music_venue")) return "MUSIC_CLUB";
  if (
    types.has("performing_arts_theater") ||
    types.has("art_gallery") ||
    types.has("museum") ||
    types.has("tourist_attraction") ||
    types.has("community_center") ||
    types.has("cultural_center")
  ) {
    return "ARTS_CENTER";
  }
  if (types.has("bar") || types.has("brewery") || types.has("pub") || types.has("winery")) {
    return "BAR";
  }
  if (types.has("restaurant") || types.has("cafe") || types.has("meal_takeaway")) {
    return "RESTAURANT";
  }
  return "OTHER";
}

export function inferDecisionMakerRole(venueType: VenueType): string {
  switch (venueType) {
    case "MUSIC_CLUB":
      return "Talent Buyer";
    case "BAR":
      return "Owner";
    case "RESTAURANT":
      return "Manager";
    case "ARTS_CENTER":
      return "Event Coordinator";
    case "FARMERS_MARKET":
    case "FESTIVAL":
      return "Event Coordinator";
    default:
      return "Manager";
  }
}

export async function searchNearbyVenues(opts: {
  center: { lat: number; lng: number };
  radiusMiles: number;
  apiKey: string;
}): Promise<GooglePlace[]> {
  const radiusMeters = Math.min(opts.radiusMiles * MILES_TO_METERS, MAX_RADIUS_METERS);

  const body = {
    includedTypes: INCLUDED_TYPES,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: opts.center.lat, longitude: opts.center.lng },
        radius: radiusMeters,
      },
    },
  };

  const res = await fetch(PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": opts.apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Places error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as { places?: GooglePlace[] };
  return data.places ?? [];
}

export function isExcludedVenue(name: string): boolean {
  return EXCLUDED_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function placeToDiscoveredVenue(
  place: GooglePlace,
  showLocation: { lat: number; lng: number }
): DiscoveredVenue | null {
  if (!place.location || !place.displayName?.text) return null;
  if (isExcludedVenue(place.displayName.text)) return null;
  const venueType = classifyVenueType(place);
  const distance = haversineMiles(showLocation, {
    lat: place.location.latitude,
    lng: place.location.longitude,
  });
  const address = place.formattedAddress ?? "";
  return {
    googlePlaceId: place.id,
    name: place.displayName.text,
    address,
    city: parseCityFromAddress(address),
    state: parseStateFromAddress(address),
    lat: place.location.latitude,
    lng: place.location.longitude,
    phone: place.nationalPhoneNumber ?? null,
    website: place.websiteUri ?? null,
    venueType,
    decisionMakerRole: inferDecisionMakerRole(venueType),
    distanceMiles: Math.round(distance * 10) / 10,
  };
}
