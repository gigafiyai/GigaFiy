// Multi-source venue deduplication.
//
// Each discovery source (Google Places, Setlist.fm, OSM, future Foursquare,
// etc.) returns overlapping venues — the same physical room, with different
// names, slightly different lat/lng, and different metadata.
//
// Dedup strategy:
// 1. Group candidates by a coarse geo-bucket (~50m). Anything in the same
//    bucket is almost certainly the same venue.
// 2. Within a bucket, fuzzy-match on normalized name. If the name distance
//    is small enough, merge.
// 3. Merging picks the best metadata from each source (highest-signal source
//    wins on type; richest source wins on missing fields).

import type { VenueType } from "@gigify/db";

export type SourceTag = "google_places" | "setlist_fm" | "openstreetmap" | "foursquare" | "manual";

export type Candidate = {
  source: SourceTag;
  externalId: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  phone: string | null;
  website: string | null;
  venueType: VenueType;
  decisionMakerRole?: string;
  distanceMiles?: number;
  signals?: {
    hostsLiveMusic?: boolean;
    recentShowCount?: number;
  };
};

export type DedupedCandidate = Candidate & {
  sources: SourceTag[]; // all sources that found this venue
};

// ~50m at the equator. Close enough to be the same physical building.
const GEO_BUCKET = 0.0005;

function geoKey(lat: number, lng: number): string {
  return `${Math.round(lat / GEO_BUCKET) * GEO_BUCKET},${Math.round(lng / GEO_BUCKET) * GEO_BUCKET}`;
}

// Normalize venue names for comparison: lowercase, strip punctuation, drop
// articles + common suffixes ("the", "restaurant", "bar", "and").
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(the|a|an|of|at|and|restaurant|bar|pub|grill|kitchen|cafe|coffee|llc|inc)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Levenshtein edit distance, iterative, O(m*n) — fine for short strings.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = new Array(b.length + 1);
  let curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  // Substring match for long names
  if (na.length >= 6 && nb.length >= 6 && (na.includes(nb) || nb.includes(na))) return true;
  // Levenshtein on shorter pairs — small edit distance = likely typo / variant
  const dist = levenshtein(na, nb);
  const lenMin = Math.min(na.length, nb.length);
  if (lenMin >= 8 && dist <= 2) return true;
  if (lenMin >= 5 && dist <= 1) return true;
  return false;
}

// Higher rank = better metadata trust.
const SOURCE_RANK: Record<SourceTag, number> = {
  manual: 100,
  setlist_fm: 80, // best signal: known live-music venue
  google_places: 60,
  foursquare: 50,
  openstreetmap: 40, // broadest but lowest metadata quality
};

// Coord precision is separate from overall rank: Setlist.fm returns
// city-level coords (all venues in city X share one lat/lng), while
// Google/OSM return building-level coords. When sources merge, the most
// precise coords win regardless of overall source rank.
const COORD_PRECISION_RANK: Record<SourceTag, number> = {
  manual: 100,
  google_places: 90,
  foursquare: 85,
  openstreetmap: 80,
  setlist_fm: 30,
};

function merge(into: DedupedCandidate, from: Candidate): DedupedCandidate {
  if (!into.sources.includes(from.source)) into.sources.push(from.source);
  const fromRank = SOURCE_RANK[from.source] ?? 0;
  const intoRank = SOURCE_RANK[into.source] ?? 0;

  // Higher-ranked source wins on the primary fields.
  if (fromRank > intoRank) {
    into.source = from.source;
    into.externalId = from.externalId;
    into.name = from.name;
    into.venueType = from.venueType;
    if (from.decisionMakerRole) into.decisionMakerRole = from.decisionMakerRole;
  }

  // Coords: prefer building-precision over city-precision regardless of
  // overall source rank. Setlist.fm is reliable for "this venue hosts live
  // music" but its coords are useless for geo.
  const fromCoordRank = COORD_PRECISION_RANK[from.source] ?? 0;
  const intoCoordRank = COORD_PRECISION_RANK[into.source] ?? 0;
  if (fromCoordRank > intoCoordRank) {
    into.lat = from.lat;
    into.lng = from.lng;
  }

  // Always fill blanks from whichever source has them.
  if (!into.address && from.address) into.address = from.address;
  if (!into.city && from.city) into.city = from.city;
  if (!into.state && from.state) into.state = from.state;
  if (!into.phone && from.phone) into.phone = from.phone;
  if (!into.website && from.website) into.website = from.website;

  // Signal merging: if any source says it hosts live music, that's true.
  if (from.signals?.hostsLiveMusic) {
    into.signals = { ...(into.signals ?? {}), hostsLiveMusic: true };
  }
  if (from.signals?.recentShowCount && (!into.signals?.recentShowCount || from.signals.recentShowCount > into.signals.recentShowCount)) {
    into.signals = { ...(into.signals ?? {}), recentShowCount: from.signals.recentShowCount };
  }
  return into;
}

export function dedupeCandidates(candidates: Candidate[]): DedupedCandidate[] {
  // Bucket by coarse geo, then within bucket compare names.
  const buckets = new Map<string, DedupedCandidate[]>();

  for (const c of candidates) {
    const key = geoKey(c.lat, c.lng);
    const bucket = buckets.get(key) ?? [];

    let merged = false;
    for (const existing of bucket) {
      if (namesMatch(existing.name, c.name)) {
        merge(existing, c);
        merged = true;
        break;
      }
    }
    if (!merged) {
      bucket.push({ ...c, sources: [c.source] });
    }
    buckets.set(key, bucket);
  }

  // Also do a second pass across adjacent geo buckets to catch venues that
  // straddle bucket boundaries (e.g. lat 42.3375 vs 42.3380).
  const all = [...buckets.values()].flat();
  const final: DedupedCandidate[] = [];
  const used = new Set<DedupedCandidate>();

  for (const c of all) {
    if (used.has(c)) continue;
    used.add(c);
    // Search for near-duplicates within ~100m that share a name.
    for (const other of all) {
      if (used.has(other)) continue;
      const dLat = Math.abs(c.lat - other.lat);
      const dLng = Math.abs(c.lng - other.lng);
      if (dLat > 0.001 || dLng > 0.001) continue; // ~100m guard
      if (namesMatch(c.name, other.name)) {
        merge(c, other);
        for (const s of other.sources) if (!c.sources.includes(s)) c.sources.push(s);
        used.add(other);
      }
    }
    final.push(c);
  }

  return final;
}
