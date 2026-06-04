// Shared brief assembly: loads everything Gigify knows about a venue + the
// artist and produces the Tulio agent brief. Used by both the preview endpoint
// (/api/calls/brief) and the dialer (/api/calls/dial) so the agent that calls
// is briefed identically to the one you preview.

import { prisma } from "@gigify/db";
import { buildAgentBrief, type AgentBrief, type BriefShow } from "@/lib/agent-brief";
import { recommendPrice, buildFeeHistory, type HistoricalGig } from "@/lib/pricing";
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
      venueName: true, city: true, state: true, date: true, fee: true,
      status: true, showType: true, timeStart: true, timeEnd: true,
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
    pastShows,
    upcomingShows,
    recommendedFee: price.suggested,
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
