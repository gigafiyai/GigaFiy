import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@gigify/db";
import { slugify } from "@/lib/utils";
import { Avatar } from "@/components/marketing/avatar";
import { GoingButton } from "@/components/marketing/going-button";
import { MapPin, Clock, CalendarDays, ArrowRight } from "lucide-react";
import { startOfToday as getStartOfToday } from "@/lib/today";

export const dynamic = "force-dynamic";

async function loadGig(id: string) {
  const show = await prisma.show.findUnique({
    where: { id },
    include: {
      artist: { select: { id: true, name: true, genre: true, bio: true, photoUrl: true, soundsLike: true } },
      _count: { select: { interests: true } },
    },
  });
  // Private events never get a public page.
  if (!show || show.showType === "private" || show.status === "CANCELLED") return null;
  return show;
}

function longDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function time(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const show = await loadGig(params.id);
  if (!show) return { title: "Gig not found — Gigify" };
  const title = `${show.artist.name} at ${show.venueName} — ${longDate(show.date)}`;
  return { title, description: `${show.artist.genre} in ${show.city}, ${show.state}. See who's going on Gigify.` };
}

// Public page for one gig: what, where, when, who's going, and a link to share.
export default async function GigPage({ params, searchParams }: { params: { id: string }; searchParams: { r?: string } }) {
  const show = await loadGig(params.id);
  if (!show) notFound();

  const startOfToday = getStartOfToday();
  const isPast = show.date < startOfToday || show.status === "COMPLETED";
  const artistHref = `/${slugify(show.artist.name)}`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${show.venueName}, ${show.address}, ${show.city}, ${show.state}`)}`;

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-purple flex items-center justify-center">
              <span className="text-white text-sm font-bold font-display">G</span>
            </span>
            <span className="font-display font-semibold text-lg tracking-tight">Gigify</span>
          </Link>
          <Link href="/#gigs" className="text-sm text-text-medium hover:text-text">More gigs</Link>
        </div>
      </header>

      <section className="border-b border-border bg-surface">
        <div className="max-w-3xl mx-auto px-5 py-10">
          {isPast && <p className="text-xs uppercase tracking-wide text-text-light mb-3">This show has already happened</p>}
          <div className="flex items-center gap-4">
            <Avatar name={show.artist.name} photoUrl={show.artist.photoUrl} size={64} />
            <div className="min-w-0">
              <h1 className="font-display font-semibold tracking-tight text-2xl sm:text-4xl leading-tight">{show.artist.name}</h1>
              <p className="text-sm text-text-medium mt-1">{show.artist.genre}</p>
            </div>
          </div>

          <dl className="mt-6 space-y-2.5 text-sm">
            <div className="flex items-start gap-2.5">
              <CalendarDays size={16} className="text-accent-blue shrink-0 mt-0.5" />
              <dd className="text-text">{longDate(show.date)}</dd>
            </div>
            {show.timeStart && (
              <div className="flex items-start gap-2.5">
                <Clock size={16} className="text-accent-blue shrink-0 mt-0.5" />
                <dd className="text-text">
                  {time(show.timeStart)}
                  {show.timeEnd ? ` – ${time(show.timeEnd)}` : ""}
                </dd>
              </div>
            )}
            <div className="flex items-start gap-2.5">
              <MapPin size={16} className="text-accent-blue shrink-0 mt-0.5" />
              <dd>
                <span className="text-text">{show.venueName}</span>
                <span className="text-text-medium"> · {show.city}, {show.state}</span>
                <a href={mapsHref} target="_blank" rel="noreferrer" className="block text-xs text-accent-blue mt-0.5 hover:underline">
                  {show.address} — open in Maps ↗
                </a>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {!isPast && (
        <section className="border-b border-border">
          <div className="max-w-3xl mx-auto px-5 py-8">
            <GoingButton
              showId={show.id}
              initialGoing={show._count.interests}
              shareTitle={`${show.artist.name} at ${show.venueName}, ${longDate(show.date)}`}
              referredBy={searchParams.r}
            />
          </div>
        </section>
      )}

      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-8">
          <h2 className="text-sm font-medium text-text-light uppercase tracking-wide mb-3">About {show.artist.name}</h2>
          {show.artist.soundsLike && <p className="text-sm text-text-medium mb-2">Sounds like {show.artist.soundsLike}</p>}
          <p className="text-base text-text leading-relaxed whitespace-pre-wrap line-clamp-6">{show.artist.bio}</p>
          <Link href={artistHref} className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent-blue">
            Watch the reel and see all dates <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <section>
        <div className="max-w-3xl mx-auto px-5 py-8">
          <div className="border border-border rounded-xl bg-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-text">Run a venue? Book {show.artist.name.split(" ")[0]} for a night.</p>
              <p className="text-sm text-text-medium mt-0.5">No booking fees, and free cancellation for 24 hours.</p>
            </div>
            <Link href={artistHref} className="px-4 py-2.5 rounded-lg border border-border bg-background text-sm font-medium text-text hover:bg-surface-hover shrink-0 text-center">
              Check dates
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
