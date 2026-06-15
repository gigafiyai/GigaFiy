// Shared brief assembly: loads everything Gigify knows about a venue + the
// artist and produces the Tulio agent brief. Used by both the preview endpoint
// (/api/calls/brief) and the dialer (/api/calls/dial) so the agent that calls
// is briefed identically to the one you preview.

import { prisma } from "@gigify/db";
import { buildAgentBrief, type AgentBrief, type BriefShow } from "@/lib/agent-brief";
import { recommendPrice, buildFeeHistory, type HistoricalGig } from "@/lib/pricing";
import { computeAvailableDates } from "@/lib/available-dates";
import { haversineMiles } from "@/lib/discovery";
import { slugify } from "@/lib/utils";

export type AssembledBrief = {
  brief: AgentBrief;
  venue: { id: string; name: string; phone: string | null; city: string; state: string };
  artistId: string;
  pricing: { suggested: number; low: number; high: number; basedOn: "history" | "heuristic" };
};

export async function assembleVenueBrief(venueId: string): Promise<AssembledBrief | null> {
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { nearestShow: true, artist: true },
  });
  if (!venue) return null;

  const artist = venue.artist;

  const allShows = await prisma.show.findMany({
    where: { artistId: artist.id },
    orderBy: { date: "asc" },
    select: {
      id: true, venueName: true, city: true, state: true, date: true, fee: true,
      status: true, showType: true, timeStart: true, timeEnd: true, lat: true, lng: true,
    },
  });

  const toBrief = (s: (typeof allShows)[number]): BriefShow => ({
    venueName: s.venueName,
    city: s.city,
    state: s.state,
    date: s.date.toISOString().slice(0, 10),
    fee: s.fee,
  });
  const today = new Date();
  const pastShows = allShows.filter((s) => s.status === "COMPLETED" || s.date < today).map(toBrief);
  const upcomingShows = allShows.filter((s) => s.status === "CONFIRMED" && s.date >= today).map(toBrief);

  const gigs: HistoricalGig[] = allShows
    .filter((s) => s.fee && s.fee > 0)
    .map((s) => ({
      showType: s.showType,
      fee: s.fee!,
      durationHours:
        s.timeStart && s.timeEnd
          ? Math.max(1, (s.timeEnd.getTime() - s.timeStart.getTime()) / 3_600_000)
          : null,
    }));
  const feeHistory = buildFeeHistory(gigs);
  const price = recommendPrice(
    {
      venueType: venue.venueType,
      capacityEstimate: null,
      hostsLiveMusic: venue.hostsLiveMusic,
      priceRange: venue.priceRange ?? null,
      showDayOfWeek: venue.nearestShow?.dayOfWeek ?? null,
    },
    feeHistory
  );

  // Concrete dates to pitch — including same-day double-books around an
  // existing confirmed show. Only computable when we have a nearby anchor show.
  let suggestedDates: Array<{ pretty: string; timeContext?: string; sameDayShowName?: string }> = [];
  if (venue.nearestShow) {
    const blocks = await prisma.artistAvailability.findMany({
      where: { artistId: artist.id },
      select: { date: true, type: true },
    });
    suggestedDates = computeAvailableDates({
      allShows: allShows.map((s) => ({
        id: s.id, date: s.date, timeStart: s.timeStart, timeEnd: s.timeEnd, venueName: s.venueName,
      })),
      nearestShow: {
        id: venue.nearestShow.id,
        date: venue.nearestShow.date,
        timeStart: venue.nearestShow.timeStart,
        timeEnd: venue.nearestShow.timeEnd,
        venueName: venue.nearestShow.venueName,
      },
      venueType: venue.venueType,
      availabilityBlocks: blocks,
      count: 4,
    }).map((d) => ({ pretty: d.pretty, timeContext: d.timeContext, sameDayShowName: d.sameDayShowName }));
  }

  // Lead time to the anchor show, and other confirmed passes within ~50 mi
  // LATER in the routing — the graceful fallback when the near date is too soon.
  const DAY_MS = 1000 * 60 * 60 * 24;
  const nearestShowDaysOut = venue.nearestShow
    ? Math.round((venue.nearestShow.date.getTime() - today.getTime()) / DAY_MS)
    : null;

  const prettyDate = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

  const futureNearbyShows = allShows
    .filter(
      (s) =>
        s.status === "CONFIRMED" &&
        s.date >= today &&
        s.id !== venue.nearestShow?.id &&
        haversineMiles({ lat: venue.lat, lng: venue.lng }, { lat: s.lat, lng: s.lng }) <= 50
    )
    .slice(0, 4)
    .map((s) => ({
      venueName: s.venueName,
      city: s.city,
      state: s.state,
      date: s.date.toISOString().slice(0, 10),
      prettyDate: prettyDate(s.date),
      distanceMiles: Math.round(haversineMiles({ lat: venue.lat, lng: venue.lng }, { lat: s.lat, lng: s.lng })),
    }));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const bookingLink = `${appUrl}/${slugify(artist.name)}?ref=${venue.id}`;

  const brief = buildAgentBrief({
    agentName: artist.bookingAgentName || "Tulio",
    artist: {
      name: artist.name,
      genre: artist.genre,
      bio: artist.bio,
      hometown: artist.hometown,
      drawDescription: artist.drawDescription,
      soundsLike: artist.soundsLike,
      audienceProfile: artist.audienceProfile,
      performanceStyle: artist.performanceStyle,
      accolades: artist.accolades,
      spotifyUrl: artist.spotifyUrl,
      videoReelUrl: artist.videoReelUrl,
      instagramHandle: artist.instagramHandle,
    },
    venue: {
      name: venue.name,
      city: venue.city,
      state: venue.state,
      venueType: venue.venueType,
      decisionMakerName: venue.decisionMakerName,
      decisionMakerRole: venue.decisionMakerRole,
      narrative: venue.narrative,
      hostsLiveMusic: venue.hostsLiveMusic,
      genresHosted: venue.genresHosted,
      vibe: venue.vibe,
      pastArtists: venue.pastArtists,
    },
    nearestShow: venue.nearestShow
      ? {
          venueName: venue.nearestShow.venueName,
          city: venue.nearestShow.city,
          state: venue.nearestShow.state,
          date: venue.nearestShow.date.toISOString().slice(0, 10),
          distanceMiles: Math.round(venue.distanceMiles ?? 0),
        }
      : null,
    nearestShowDaysOut,
    futureNearbyShows,
    pastShows,
    upcomingShows,
    suggestedDates,
    // Anchor to the artist's real standard rate (a typical 2-hour set) when set,
    // otherwise the per-venue heuristic.
    recommendedFee: artist.hourlyRate ? Math.round(artist.hourlyRate * 2) : price.suggested,
    hourlyRate: artist.hourlyRate,
    depositPercent: 50,
    bookingLink,
  });

  return {
    brief,
    venue: { id: venue.id, name: venue.name, phone: venue.phone, city: venue.city, state: venue.state },
    artistId: artist.id,
    pricing: { suggested: price.suggested, low: price.low, high: price.high, basedOn: price.basedOn },
  };
}
