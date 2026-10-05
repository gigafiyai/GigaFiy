// Turn a town ("Lakeville, CT") into coordinates. Tries Google Places text
// search first, then OpenStreetMap's Nominatim. Returns null when neither has
// an answer — callers treat location as optional and must keep working
// without it. Results are stored by the caller, so each town is looked up once.

type Point = { lat: number; lng: number };

async function viaGoogle(query: string): Promise<Point | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.location" },
      body: JSON.stringify({ textQuery: query, maxResultCount: 1, regionCode: "US" }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { places?: Array<{ location?: { latitude?: number; longitude?: number } }> };
    const loc = data.places?.[0]?.location;
    if (typeof loc?.latitude !== "number" || typeof loc?.longitude !== "number") return null;
    return { lat: loc.latitude, lng: loc.longitude };
  } catch {
    return null;
  }
}

// Nominatim's usage policy asks for an identifying User-Agent and light use
// (about one request a second at most). One cached lookup per venue fits that.
async function viaOpenStreetMap(query: string): Promise<Point | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Gigify/1.0 (venue town lookup)", Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const lat = Number(data[0]?.lat);
    const lng = Number(data[0]?.lon);
    if (!data[0] || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function geocodeTown(text: string): Promise<Point | null> {
  const query = text.trim();
  if (query.length < 2) return null;
  return (await viaGoogle(query)) ?? (await viaOpenStreetMap(query));
}
