import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { buildAgentBrief, type BriefShow } from "@/lib/agent-brief";
import { recommendPrice, buildFeeHistory, type HistoricalGig } from "@/lib/pricing";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

// Assembles the full Tulio agent brief for a single venue: persona + everything
// Gigify knows about the artist, this venue, the nearby show, pricing, and the
// offer. Returned as a ready-to-use system prompt + opener for a voice agent,
// plus a structured knowledge preview for the UI.
//   GET /api/calls/brief?venueId=...
export async function GET(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("venueId");
  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { nearestShow: true, artist: true },
  });
  if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  const artist = venue.artist;

  // Pull the artist's real gig history for proof points + pricing.
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

  // Pricing: prefer the artist's real historical fees.
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

  return NextResponse.json({
    ok: true,
    venue: { id: venue.id, name: venue.name, phone: venue.phone, city: venue.city, state: venue.state },
    pricing: { suggested: price.suggested, low: price.low, high: price.high, basedOn: price.basedOn },
    brief,
  });
}
