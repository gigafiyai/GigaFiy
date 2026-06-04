import { notFound } from "next/navigation";
import { prisma } from "@gigify/db";
import { slugify, formatDate } from "@/lib/utils";
import { BookingForm } from "./booking-form";
import { MapPin, Clock, ShieldCheck, Play } from "lucide-react";

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
  searchParams: { ref?: string; date?: string; time?: string; price?: string };
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
    ? await prisma.venue.findUnique({
        where: { id: ref },
        include: { nearestShow: true },
      })
    : null;

  // Fire-and-forget click logging.
  if (venue) {
    logVenueClick(venue.id).catch(() => {});
  }

  const shows = await prisma.show.findMany({
    where: { artistId: artist.id, status: "CONFIRMED" },
    orderBy: { date: "asc" },
  });

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
          <h1 className="text-3xl font-semibold text-text">{artist.name}</h1>
          <p className="text-sm text-text-medium mt-1">
            {artist.genre} · {artist.drawDescription}
          </p>

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
              The hotel-booking model — say yes today, change your mind tomorrow if you need to.
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
            Currently touring ({shows.length} shows)
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
                  <p className="text-sm text-text truncate">
                    {s.venueName} — {s.city}, {s.state}
                  </p>
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
                The details you agreed on your call are filled in below — just confirm to lock it.
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
            prefillName={venue?.decisionMakerName ?? null}
            prefillEmail={venue?.decisionMakerEmail ?? venue?.email ?? null}
            prefillVenueName={venue?.name ?? null}
            prefillDate={agreedDate}
            prefillTime={agreedTime}
            prefillPrice={agreedPrice}
          />
        </div>
      </section>

      <footer className="py-6">
        <div className="max-w-3xl mx-auto px-5 text-center">
          <p className="text-xs text-text-light">
            Powered by Gigify · {artist.contactEmail}
          </p>
        </div>
      </footer>
    </div>
  );
}
