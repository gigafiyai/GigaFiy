// Setlist.fm venue discovery.
// Free API, requires SETLIST_FM_API_KEY (https://api.setlist.fm/docs).
// Docs: https://api.setlist.fm/docs/1.0/index.html
//
// Strategy: search venues by city, since the API doesn't support geo-radius.
// City-level precision is fine — venues in the same city are almost always
// within a 25-mile radius of the show's city center.

import type { VenueType } from "@gigify/db";

const BASE_URL = "https://api.setlist.fm/rest/1.0";

export type SetlistVenue = {
  id: string;
  name: string;
  city: { name: string; stateCode?: string; coords?: { lat: number; long: number } };
};

export type SetlistDiscoveryCandidate = {
  source: "setlist_fm";
  externalId: string;
  name: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  venueType: VenueType;
  // Setlist.fm signal: these venues are guaranteed to host live music
  // because they show up in past setlists. Highest fit signal we can get.
  signals: {
    hostsLiveMusic: true;
    recentShowCount?: number;
  };
};

type VenueSearchResponse = {
  venue?: SetlistVenue[];
  total?: number;
  page?: number;
  itemsPerPage?: number;
};

// Setlist.fm requires the City to be specified — geo radius isn't supported.
// We call it once per show's city. Limit pagination to keep the call count low.
export async function discoverVenuesViaSetlistFm(opts: {
  city: string;
  state: string;
  apiKey: string;
  maxPages?: number;
}): Promise<SetlistDiscoveryCandidate[]> {
  const maxPages = Math.min(opts.maxPages ?? 2, 5); // 30-150 venues per show, plenty
  const out: SetlistDiscoveryCandidate[] = [];

  for (let page = 1; page <= maxPages; page++) {
    const url = new URL(`${BASE_URL}/search/venues`);
    url.searchParams.set("cityName", opts.city);
    if (opts.state) url.searchParams.set("stateCode", opts.state);
    url.searchParams.set("p", String(page));

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "x-api-key": opts.apiKey,
      },
    });

    if (res.status === 404) break; // no more results
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Setlist.fm error ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = (await res.json()) as VenueSearchResponse;
    const venues = data.venue ?? [];
    if (venues.length === 0) break;

    for (const v of venues) {
      const lat = v.city?.coords?.lat;
      const lng = v.city?.coords?.long;
      if (!lat || !lng) continue;
      // Setlist.fm doesn't classify venue types — default to MUSIC_CLUB
      // (everything here hosts live music by definition). The reclassifier
      // in lib/discovery.ts will refine based on name later.
      out.push({
        source: "setlist_fm",
        externalId: v.id,
        name: v.name,
        city: v.city.name,
        state: v.city.stateCode ?? opts.state,
        lat,
        lng,
        venueType: "MUSIC_CLUB",
        signals: { hostsLiveMusic: true },
      });
    }

    if (venues.length < 20) break; // partial page = last page
  }

  return out;
}
