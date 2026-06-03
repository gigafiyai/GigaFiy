// Google Places "Text Search" backfill.
// Venues discovered via Setlist.fm / OpenStreetMap often arrive with only a
// name + location — no website, no phone. The free scraper needs a website to
// do anything, so those venues were dead ends. This looks them up by
// "{name} {city} {state}" and returns the website + phone + place id, so the
// scraper has something to work with AND we get a phone for the call list.
//
// Uses the Google Places API (New) Text Search endpoint. ~$32/1000 calls, so
// only run on venues that actually lack a website.

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.websiteUri",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.formattedAddress",
  "places.primaryType",
  "places.types",
  "places.businessStatus",
].join(",");

export type PlacesBackfill = {
  found: boolean;
  website: string | null;
  phone: string | null;
  placeId: string | null;
  address: string | null;
  primaryType: string | null;
  closed: boolean; // permanently closed
};

const EMPTY: PlacesBackfill = {
  found: false, website: null, phone: null, placeId: null,
  address: null, primaryType: null, closed: false,
};

export async function backfillFromPlaces(opts: {
  name: string;
  city: string;
  state: string;
}): Promise<PlacesBackfill> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return EMPTY;

  const textQuery = `${opts.name} ${opts.city} ${opts.state}`.trim();

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    });
    if (!res.ok) return EMPTY;

    const data = (await res.json()) as {
      places?: Array<{
        id?: string;
        displayName?: { text?: string };
        websiteUri?: string;
        nationalPhoneNumber?: string;
        internationalPhoneNumber?: string;
        formattedAddress?: string;
        primaryType?: string;
        businessStatus?: string;
      }>;
    };

    const p = data.places?.[0];
    if (!p) return EMPTY;

    // Light sanity check: the returned name should loosely resemble the query
    // so we don't attach a random business. Token overlap is enough.
    const want = opts.name.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 2);
    const got = (p.displayName?.text ?? "").toLowerCase();
    const overlap = want.filter((w) => got.includes(w)).length;
    if (want.length > 0 && overlap === 0) return EMPTY; // no token matched — wrong place

    return {
      found: true,
      website: p.websiteUri ?? null,
      phone: p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null,
      placeId: p.id ?? null,
      address: p.formattedAddress ?? null,
      primaryType: p.primaryType ?? null,
      closed: p.businessStatus === "CLOSED_PERMANENTLY",
    };
  } catch {
    return EMPTY;
  }
}
