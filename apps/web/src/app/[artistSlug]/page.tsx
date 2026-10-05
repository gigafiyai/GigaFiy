import { notFound } from "next/navigation";
import { prisma } from "@gigify/db";
import { slugify, formatDate } from "@/lib/utils";
import { BookingForm } from "./booking-form";
import { Avatar } from "@/components/marketing/avatar";
import { MapPin, Clock, ShieldCheck, Play } from "lucide-react";
import { startOfToday as getStartOfToday } from "@/lib/today";

export const dynamic = "force-dynamic";

async function loadArtist(slug: string) {
  const artists = await prisma.artist.findMany();
  return artists.find((a) => slugify(a.name) === slug) ?? null;
}

async function logVenueClick(venueId: string) {
  const outreach = await prisma.outreach.findFirst({
    where: { venueId, channel: "EMAIL" },
    orderBy: { createdAt: "desc" },
  });
  if (!outreach) return;
  const updates: { clickedAt?: Date; status?: "CLICKED" } = {};
  if (!outreach.clickedAt) updates.clickedAt = new Date();
  if (outreach.status === "SENT" || outreach.status === "OPENED") updates.status = "CLICKED";
  if (Object.keys(updates).length > 0) {
    await prisma.outreach.update({ where: { id: outreach.id }, data: updates });
  }
}

export default async function ArtistLandingPage({
  params,
  searchParams,
}: {
  params: { artistSlug: string };
  searchParams: { ref?: string; date?: string; time?: string; price?: string; v?: string; night?: string };
}) {
  const artist = await loadArtist(params.artistSlug);
  if (!artist) notFound();

  const ref = searchParams.ref;
  // Terms Tulio locked on the call (carried in the booking-link URL).
  const agreedDate = searchParams.date ?? null;
  const agreedTime = searchParams.time ?? null;
  const agreedPrice = searchParams.price ?? null;
  const hasAgreedTerms = !!agreedDate;
  const venue = ref
    ? await prisma.venue.findFirst({
        where: { id: ref, artistId: artist.id },
        include: { nearestShow: true },
      })
    : null;

  // Arriving from a venue workspace (v = its own link) or from a night the
  // venue posted (night): fill in who they are so they only have to confirm.
  const openNight = searchParams.night
    ? await prisma.openNight.findUnique({ where: { id: searchParams.night }, include: { venueAccount: true } })
    : null;
  const venueAccount = searchParams.v
    ? await prisma.venueAccount.findUnique({ where: { accessToken: searchParams.v } })
    : openNight?.venueAccount ?? null;

  // Fire-and-forget click logging.
  if (venue) {
    logVenueClick(venue.id).catch(() => {});
  }

  const startOfToday = getStartOfToday();
  const [shows, playedCount, verifiedBookings] = await Promise.all([
    prisma.show.findMany({
      where: { artistId: artist.id, status: "CONFIRMED", date: { gte: startOfToday } },
      orderBy: { date: "asc" },
    }),
    // Track record: shows already played, and bookings confirmed through Gigify.
    prisma.show.count({
      where: { artistId: artist.id, status: { in: ["CONFIRMED", "COMPLETED"] }, date: { lt: startOfToday } },
    }),
    prisma.bookingAgreement.count({ where: { artistId: artist.id } }),
  ]);

  const kit: { label: string; value: string }[] = [
    artist.soundsLike ? { label: "Sounds like", value: artist.soundsLike } : null,
    artist.performanceStyle ? { label: "The show", value: artist.performanceStyle } : null,
    artist.audienceProfile ? { label: "Who comes", value: artist.audienceProfile } : null,
    artist.accolades ? { label: "Highlights", value: artist.accolades } : null,
  ].filter((k): k is { label: string; value: string } => k !== null);

  const greetingLine = venue?.decisionMakerName
    ? `Hi ${venue.decisionMakerName.split(" ")[0]} — built just for ${venue.name}.`
    : venue
      ? `Built just for ${venue.name}.`
      : null;

  return (
    <div className="min-h-screen bg-background text-text">
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-5 py-10">
          {greetingLine && (
            <p className="text-xs uppercase tracking-wide text-accent-blue mb-3">
              {greetingLine}
            </p>
          )}
          <div className="flex items-center gap-4">
            <Avatar name={artist.name} photoUrl={artist.photoUrl} size={64} />
            <div className="min-w-0">
              <h1 className="text-3xl font-semibold text-text">{artist.name}</h1>
              <p className="text-sm text-text-medium mt-1">
                {artist.genre} · {artist.drawDescription}
              </p>
            </div>
          </div>

          {/* Reel — autoplays muted (browser policy) */}
          <div className="mt-6 aspect-video rounded-lg overflow-hidden border border-border bg-black flex items-center justify-center">
            {artist.videoReelUrl ? (
              <video
                src={artist.videoReelUrl}
                autoPlay
                muted
                loop
                playsInline
                controls
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-text-light flex items-center gap-2 text-sm">
                <Play size={16} />
                Reel coming soon
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Offer strip */}
      <section className="border-b border-border bg-success-green-bg">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-start gap-3">
          <ShieldCheck size={18} className="text-success-green shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-success-green">
              50% deposit holds the date · Free cancellation within 24 hours, no questions asked.
            </p>
            <p className="text-xs text-text-medium mt-0.5">
              Say yes today, change your mind tomorrow if you need to. No booking fees — you pay only the performance fee, by deposit or cash on the night.
            </p>
          </div>
        </div>
      </section>

      {/* Proximity proof (if from venue) */}
      {venue?.nearestShow && (
        <section className="border-b border-border bg-background">
          <div className="max-w-3xl mx-auto px-5 py-5 flex items-start gap-3">
            <MapPin size={16} className="text-accent-blue shrink-0 mt-0.5" />
            <p className="text-sm text-text-medium">
              Already confirmed at{" "}
              <span className="text-text font-medium">
                {venue.nearestShow.venueName}
              </span>{" "}
              in {venue.nearestShow.city}, {venue.nearestShow.state} on{" "}
              <span className="text-text font-medium">
                {formatDate(venue.nearestShow.date)}
              </span>
              {venue.distanceMiles != null && (
                <> — {Math.round(venue.distanceMiles)} miles from {venue.name}.</>
              )}
            </p>
          </div>
        </section>
      )}

      {/* Bio */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-8">
          <h2 className="text-sm font-medium text-text-light uppercase tracking-wide mb-3">
            About
          </h2>
          <p className="text-base text-text leading-relaxed whitespace-pre-wrap">
            {artist.bio}
          </p>
          {kit.length > 0 && (
            <dl className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {kit.map((k) => (
                <div key={k.label}>
                  <dt className="text-xs uppercase tracking-wide text-text-light">{k.label}</dt>
                  <dd className="text-sm text-text-medium mt-0.5 whitespace-pre-wrap">{k.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {(playedCount > 0 || verifiedBookings > 0) && (
            <p className="mt-5 text-sm text-text-medium flex items-center gap-2 flex-wrap">
              <ShieldCheck size={14} className="text-success-green shrink-0" />
              {playedCount > 0 && <span>{playedCount} show{playedCount === 1 ? "" : "s"} played</span>}
              {playedCount > 0 && verifiedBookings > 0 && <span className="text-text-light">·</span>}
              {verifiedBookings > 0 && (
                <span>{verifiedBookings} booking{verifiedBookings === 1 ? "" : "s"} confirmed on Gigify</span>
              )}
            </p>
          )}
          <div className="mt-4 flex gap-3 flex-wrap">
            {artist.spotifyUrl && (
              <a
                href={artist.spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent-blue hover:underline"
              >
                Spotify ↗
              </a>
            )}
            {artist.epkUrl && (
              <a
                href={artist.epkUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-accent-blue hover:underline"
              >
                EPK ↗
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Confirmed shows */}
      <section className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-5 py-8">
          <h2 className="text-sm font-medium text-text-light uppercase tracking-wide mb-3">
            Upcoming shows ({shows.length})
          </h2>
          <ul className="border border-border rounded-lg bg-background divide-y divide-border overflow-hidden">
            {shows.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-4 px-4 py-3"
              >
                <div className="w-14 text-center shrink-0">
                  <p className="text-xs text-text-light uppercase">
                    {s.dayOfWeek.slice(0, 3)}
                  </p>
                  <p className="text-sm font-medium text-text">
                    {s.date.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <a href={`/gigs/${s.id}`} className="text-sm text-text truncate block hover:text-accent-blue">
                    {s.venueName} — {s.city}, {s.state}
                  </a>
                  {s.timeStart && (
                    <p className="text-xs text-text-light flex items-center gap-1 mt-0.5">
                      <Clock size={11} />
                      {s.timeStart.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Booking form */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-10">
          <h2 className="text-sm font-medium text-text-light uppercase tracking-wide mb-3">
            Book {artist.name.split(" ")[0]}
          </h2>

          {hasAgreedTerms && (
            <div className="mb-4 border border-success-green/30 bg-success-green-bg rounded-lg px-4 py-3">
              <p className="text-sm font-medium text-success-green">
                {agreedTime || agreedPrice
                  ? "The details you agreed are filled in below — just confirm to lock it."
                  : "Your date is filled in below — add the details and request to book."}
              </p>
              <p className="text-sm text-text-medium mt-1">
                {formatDate(new Date(agreedDate + "T00:00:00"))}
                {agreedTime ? ` at ${agreedTime}` : ""}
                {agreedPrice ? ` · $${agreedPrice}` : ""}
              </p>
            </div>
          )}

          <BookingForm
            artistId={artist.id}
            artistName={artist.name}
            venueId={venue?.id ?? null}
            prefillName={venue?.decisionMakerName ?? venueAccount?.contactName ?? null}
            prefillEmail={venue?.decisionMakerEmail ?? venue?.email ?? venueAccount?.email ?? null}
            prefillVenueName={venue?.name ?? venueAccount?.name ?? null}
            prefillCity={venueAccount?.city ?? null}
            venueToken={searchParams.v ?? null}
            openNightId={openNight?.id ?? null}
            prefillDate={agreedDate}
            prefillTime={agreedTime}
            prefillPrice={agreedPrice}
          />
        </div>
      </section>

      <footer className="py-6">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <p className="text-xs text-text-light">
            Booked through Gigify — free for venues and artists. Agreement, deposit and
            cancellation handled in one place. · {artist.contactEmail}
          </p>
          <a href="/" className="inline-block mt-2 text-xs text-accent-blue hover:underline">
            See more acts and gigs on Gigify →
          </a>
        </div>
      </footer>
    </div>
  );
}
