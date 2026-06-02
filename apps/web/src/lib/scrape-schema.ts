// Schema.org / JSON-LD extraction from venue HTML.
// Many modern venue websites (especially those using Squarespace, Wix,
// WordPress) automatically emit structured LocalBusiness data.
// This is the fastest possible enrichment — one parse of the homepage HTML
// that we already fetched, no extra HTTP calls.

export type SchemaContact = {
  email: string | null;
  phone: string | null;
  priceRange: string | null;
  openingHours: string[] | null;
  servesCuisine: string | null;
  description: string | null;
  sameAs: string[]; // social media URLs
};

type JsonLdObject = Record<string, unknown>;

function extractJsonLdBlocks(html: string): JsonLdObject[] {
  const results: JsonLdObject[] = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (Array.isArray(parsed)) {
        results.push(...parsed);
      } else if (parsed && typeof parsed === "object") {
        results.push(parsed);
        // Handle @graph arrays
        if (Array.isArray((parsed as JsonLdObject)["@graph"])) {
          results.push(...((parsed as JsonLdObject)["@graph"] as JsonLdObject[]));
        }
      }
    } catch {}
  }
  return results;
}

const BUSINESS_TYPES = new Set([
  "LocalBusiness", "FoodEstablishment", "BarOrPub", "NightClub",
  "Restaurant", "CafeOrCoffeeShop", "PerformingArtsTheater",
  "MusicVenue", "EntertainmentBusiness", "Organization", "Place",
  "Winery", "Brewery",
]);

function isVenueObject(obj: JsonLdObject): boolean {
  const type = obj["@type"];
  if (!type) return false;
  const types = Array.isArray(type) ? type : [type];
  return types.some((t) => typeof t === "string" && BUSINESS_TYPES.has(t));
}

function asString(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (v && typeof v === "object" && "@value" in (v as object)) {
    return asString((v as { "@value": unknown })["@value"]);
  }
  return null;
}

function extractEmail(obj: JsonLdObject): string | null {
  const raw = asString(obj["email"]);
  if (raw?.includes("@")) return raw.toLowerCase().replace(/^mailto:/i, "");
  // contactPoint
  const cp = obj["contactPoint"];
  if (cp && typeof cp === "object" && !Array.isArray(cp)) {
    const cpe = asString((cp as JsonLdObject)["email"]);
    if (cpe?.includes("@")) return cpe.toLowerCase();
  }
  return null;
}

function extractSameAs(obj: JsonLdObject): string[] {
  const sa = obj["sameAs"];
  if (!sa) return [];
  const arr = Array.isArray(sa) ? sa : [sa];
  return arr.filter((s): s is string => typeof s === "string" && s.startsWith("http"));
}

export function extractSchemaContact(html: string): SchemaContact {
  const blocks = extractJsonLdBlocks(html);
  const venue = blocks.find(isVenueObject);

  if (!venue) {
    return { email: null, phone: null, priceRange: null, openingHours: null, servesCuisine: null, description: null, sameAs: [] };
  }

  const openingHours = venue["openingHours"];
  const hours: string[] | null = Array.isArray(openingHours)
    ? (openingHours as unknown[]).filter((h): h is string => typeof h === "string")
    : asString(openingHours)
    ? [asString(openingHours) as string]
    : null;

  return {
    email: extractEmail(venue),
    phone: asString(venue["telephone"]) ?? null,
    priceRange: asString(venue["priceRange"]) ?? null,
    openingHours: hours,
    servesCuisine: asString(venue["servesCuisine"]) ?? null,
    description: asString(venue["description"]) ?? null,
    sameAs: extractSameAs(venue),
  };
}

// Extract Instagram from sameAs links.
export function instagramFromSameAs(urls: string[]): string | null {
  const ig = urls.find((u) => u.includes("instagram.com/"));
  if (!ig) return null;
  const m = ig.match(/instagram\.com\/([a-z0-9._]+)/i);
  return m ? `@${m[1]}` : null;
}

// Extract Facebook from sameAs links.
export function facebookFromSameAs(urls: string[]): string | null {
  return urls.find((u) => u.includes("facebook.com/") && !u.includes("/sharer")) ?? null;
}
