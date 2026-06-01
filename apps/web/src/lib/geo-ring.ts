// Generates a ring of query points around a center coordinate.
// Used to get more venues from APIs that return max ~20 results per query
// by querying from multiple offset centers within the same radius.
//
// Without this: Google Places returns ≤20 venues within 25mi of a single point.
// With a 5-point ring (center + 4 cardinals at 40% of radius): ~5× more unique
// venues before deduplication.

const EARTH_MILES = 3958.8;
const DEG = Math.PI / 180;

// Offset a lat/lng by `distanceMiles` in a `bearing` direction (degrees from N).
function offsetPoint(
  lat: number,
  lng: number,
  distanceMiles: number,
  bearing: number
): { lat: number; lng: number } {
  const d = distanceMiles / EARTH_MILES;
  const b = bearing * DEG;
  const lat1 = lat * DEG;
  const lng1 = lng * DEG;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(b) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );
  return { lat: lat2 / DEG, lng: lng2 / DEG };
}

// Returns the center plus N evenly-spaced ring points.
// ringCount=4 → center + N/E/S/W = 5 query points
// ringCount=8 → center + N/NE/E/SE/S/SW/W/NW = 9 query points
export function buildQueryRing(
  center: { lat: number; lng: number },
  radiusMiles: number,
  ringCount: 4 | 8 = 4
): Array<{ lat: number; lng: number }> {
  const points = [center];
  // Offset ring at 45% of radius — close enough to overlap with center coverage,
  // far enough to find venues the center query missed.
  const offsetDist = radiusMiles * 0.45;
  for (let i = 0; i < ringCount; i++) {
    const bearing = (360 / ringCount) * i;
    points.push(offsetPoint(center.lat, center.lng, offsetDist, bearing));
  }
  return points;
}
