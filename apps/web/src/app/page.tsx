import Link from "next/link";
import { prisma } from "@gigify/db";
import { slugify } from "@/lib/utils";
import { JoinForm } from "@/components/marketing/join-form";
import { Avatar } from "@/components/marketing/avatar";
import { MapPin, Clock, Search, Music, Store, Mic2, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Gigify — live gigs near you, and the easy way to book them",
  description: "Find live music near you. Venues book local acts in one tap. Artists keep 100% of their fee.",
};

// The public front door: what's on nearby (fans), who you can book (venues),
// and a way in for artists. Everything here is real data — no placeholder gigs.
export default async function HomePage({ searchParams }: { searchParams: { q?: string; r?: string } }) {
  const q = (searchParams.q ?? "").trim();
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [gigs, artists] = await Promise.all([
    prisma.show.findMany({
      where: {
        status: "CONFIRMED",
        date: { gte: startOfToday },
        showType: { not: "private" },
        ...(q
          ? { OR: [{ city: { contains: q, mode: "insensitive" } }, { state: { equals: q, mode: "insensitive" } }, { venueName: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { date: "asc" },
      take: 12,
      include: { artist: { select: { name: true, genre: true } }, _count: { select: { interests: true } } },
    }),
    prisma.artist.findMany({
      orderBy: { createdAt: "asc" },
      take: 12,
      select: {
        id: true, name: true, genre: true, hometown: true, hourlyRate: true, soundsLike: true, photoUrl: true,
        _count: { select: { shows: { where: { status: { in: ["CONFIRMED", "COMPLETED"] }, date: { lt: startOfToday } } } } },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-background text-text">
      {/* Nav */}
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-purple flex items-center justify-center">
              <span className="text-white text-sm font-bold font-display">G</span>
            </span>
            <span className="font-display font-semibold text-lg tracking-tight">Gigify</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <a href="#gigs" className="hidden sm:inline text-text-medium hover:text-text">Find gigs</a>
            <a href="#acts" className="hidden sm:inline text-text-medium hover:text-text">Book an act</a>
            <Link href="/today" className="px-3 py-1.5 rounded-lg border border-border text-text hover:bg-surface">Artist tools</Link>
          </nav>
        </div>
      </header>

      {/* Hero + search */}
      <section className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-5 py-12 sm:py-16">
          <h1 className="font-display font-semibold tracking-tight text-3xl sm:text-5xl leading-tight max-w-2xl">
            Live gigs near you — and the easy way to book them.
          </h1>
          <p className="text-base text-text-medium mt-4 max-w-xl">
            See who&apos;s playing nearby. Venues book local acts in one tap. Artists keep 100% of their fee.
          </p>
          <form action="/" method="get" className="mt-6 flex gap-2 max-w-lg">
            <div className="flex-1 flex items-center gap-2 px-3 bg-background border border-border rounded-lg focus-within:border-accent-blue">
              <Search size={16} className="text-text-light shrink-0" />
              <input
                name="q" defaultValue={q} placeholder="Town, state or venue" aria-label="Search by town, state or venue"
                className="flex-1 py-3 text-sm bg-transparent text-text focus:outline-none placeholder:text-text-light"
              />
            </div>
            <button type="submit" className="px-5 rounded-lg bg-accent-blue text-white text-sm font-medium hover:opacity-90">Search</button>
          </form>
        </div>
      </section>

      {/* Gigs */}
      <section id="gigs" className="border-b border-border">
        <div className="max-w-5xl mx-auto px-5 py-10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display font-semibold text-xl">{q ? `Coming up near “${q}”` : "Coming up"}</h2>
            {q && <Link href="/" className="text-sm text-accent-blue">Clear search</Link>}
          </div>
          {gigs.length === 0 ? (
            <div className="mt-4 border border-border rounded-xl bg-surface p-6">
              <p className="text-sm text-text">{q ? `No gigs listed near “${q}” yet.` : "No upcoming gigs are listed yet."}</p>
              <p className="text-sm text-text-medium mt-1">
                Gigify is just getting started. <a href="#join" className="text-accent-blue">Join the list</a> and we&apos;ll tell you when shows are added in your area.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {gigs.map((g) => (
                <li key={g.id}>
                  <Link href={`/gigs/${g.id}`} className="flex gap-4 border border-border rounded-xl bg-surface p-4 hover:border-border-medium h-full">
                    <div className="w-12 text-center shrink-0">
                      <p className="text-xs uppercase text-accent-blue">{g.date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</p>
                      <p className="text-2xl font-semibold font-display leading-none mt-0.5">{g.date.toLocaleDateString("en-US", { day: "numeric", timeZone: "UTC" })}</p>
                      <p className="text-xs text-text-light mt-1">{g.dayOfWeek.slice(0, 3)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{g.artist.name}</p>
                      <p className="text-xs text-text-light truncate">{g.artist.genre}</p>
                      <p className="text-sm text-text-medium mt-2 truncate">{g.venueName}</p>
                      <p className="text-xs text-text-light flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {g.city}, {g.state}
                        {g.timeStart && (
                          <>
                            <Clock size={11} className="ml-2" />
                            {g.timeStart.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}
                          </>
                        )}
                      </p>
                      {g._count.interests > 0 && <p className="text-xs text-success-green mt-1.5">{g._count.interests} going</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Acts */}
      <section id="acts" className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-5 py-10">
          <h2 className="font-display font-semibold text-xl">Acts you can book</h2>
          <p className="text-sm text-text-medium mt-1">Watch the reel, check dates, hold a night. 50% deposit or cash on the night, free cancellation for 24 hours, no booking fees.</p>
          <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {artists.map((a) => (
              <li key={a.id}>
                <Link href={`/${slugify(a.name)}`} className="block border border-border rounded-xl bg-background p-4 hover:border-border-medium h-full">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.name} photoUrl={a.photoUrl} size={44} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{a.name}</p>
                      <p className="text-xs text-text-light truncate">{a.genre}{a.hometown ? ` · ${a.hometown}` : ""}</p>
                    </div>
                  </div>
                  {a.soundsLike && <p className="text-xs text-text-medium mt-3 line-clamp-2">Sounds like {a.soundsLike}</p>}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-text-medium">
                      {a.hourlyRate ? `From $${Math.round(a.hourlyRate)}/hr` : "Rate on request"}
                      {a._count.shows > 0 ? ` · ${a._count.shows} shows played` : ""}
                    </span>
                    <span className="text-accent-blue flex items-center gap-1">Check dates <ArrowRight size={12} /></span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Three audiences */}
      <section className="border-b border-border">
        <div className="max-w-5xl mx-auto px-5 py-10">
          <h2 className="font-display font-semibold text-xl">One place for the whole night</h2>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { icon: Music, title: "If you go to shows", body: "Find out what's on near you this week, and invite the venues and acts you'd like to see more of." },
              { icon: Store, title: "If you run a venue", body: "Never booked live music? Browse acts near you with their reel, rate and open dates, then hold a night. Cancel free within 24 hours." },
              { icon: Mic2, title: "If you perform", body: "A booking page venues can say yes on, plus a daily list of the best venues to call. Free, and you keep the whole fee." },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="border border-border rounded-xl bg-surface p-5">
                <Icon size={18} className="text-accent-blue" />
                <p className="text-sm font-medium text-text mt-3">{title}</p>
                <p className="text-sm text-text-medium mt-1 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Join */}
      <section id="join" className="border-b border-border bg-surface">
        <div className="max-w-2xl mx-auto px-5 py-12">
          <h2 className="font-display font-semibold text-xl">Get early access</h2>
          <p className="text-sm text-text-medium mt-1 mb-4">We&apos;re opening town by town. Tell us where you are and what you do.</p>
          <JoinForm referredBy={searchParams.r} defaultCity={q || undefined} />
        </div>
      </section>

      <footer className="py-6">
        <div className="max-w-5xl mx-auto px-5 flex items-center justify-between text-xs text-text-light">
          <span>© {now.getFullYear()} Gigify</span>
          <Link href="/today" className="hover:text-text">Artist sign in</Link>
        </div>
      </footer>
    </div>
  );
}
