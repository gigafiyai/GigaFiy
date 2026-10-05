import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@gigify/db";
import { slugify } from "@/lib/utils";
import { startOfToday, todayIso } from "@/lib/today";
import { FindActs, OpenNights, SaveLinkNotice, type NightRow } from "@/components/venue/venue-workspace";

export const dynamic = "force-dynamic";
// The URL is the key to this page, so keep it out of search engines and referrers.
export const metadata = { title: "Your venue — Gigify", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

function longDate(d: Date | null) {
  return d ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }) : "Date to be confirmed";
}

// The venue-side app: bookings, finding an act for a night, and posting nights
// to fill. Reached by the venue's private link.
export default async function VenueWorkspacePage({ params, searchParams }: { params: { token: string }; searchParams: { new?: string } }) {
  const account = await prisma.venueAccount.findUnique({
    where: { accessToken: params.token },
    include: {
      openNights: { where: { date: { gte: startOfToday() } }, orderBy: { date: "asc" } },
      bookings: { orderBy: { showDate: "asc" }, include: { pipeline: { select: { stage: true, artist: { select: { name: true, genre: true } } } } } },
    },
  });
  if (!account) notFound();

  const today = startOfToday();
  const upcoming = account.bookings.filter((b) => !b.showDate || b.showDate >= today);
  const past = account.bookings.filter((b) => b.showDate && b.showDate < today);
  const nights: NightRow[] = account.openNights.map((n) => ({ id: n.id, date: n.date.toISOString().slice(0, 10), budget: n.budget, notes: n.notes, status: n.status }));

  const bookingRow = (b: (typeof account.bookings)[number], rebook: boolean) => (
    <li key={b.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text">{b.pipeline.artist.name} <span className="text-text-light font-normal">· {b.pipeline.artist.genre}</span></p>
        <p className="text-xs text-text-medium mt-0.5">
          {longDate(b.showDate)}
          {b.startTime ? ` · ${b.startTime}` : ""}
          {b.gigFee != null ? ` · $${Math.round(b.gigFee)}` : ""}
          {` · ${b.settleMethod === "cash" ? "cash on the night" : b.pipeline.stage === "BOOKED" || b.pipeline.stage === "DEPOSIT" ? "deposit paid" : "deposit pending"}`}
        </p>
        <details className="mt-1">
          <summary className="text-xs text-accent-blue cursor-pointer">Agreement</summary>
          <ol className="mt-1.5 space-y-1 list-decimal list-inside">
            {b.terms.map((t, i) => <li key={i} className="text-xs text-text-medium leading-snug">{t}</li>)}
          </ol>
        </details>
      </div>
      {rebook && (
        <a href={`/${slugify(b.pipeline.artist.name)}?v=${account.accessToken}`} className="text-sm px-3 py-1.5 rounded-lg border border-border bg-surface text-text hover:bg-surface-hover shrink-0 text-center">
          Book again
        </a>
      )}
    </li>
  );

  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-purple flex items-center justify-center">
              <span className="text-white text-sm font-bold font-display">G</span>
            </span>
            <span className="font-display font-semibold text-lg tracking-tight">Gigify</span>
            <span className="text-xs text-text-light border border-border rounded px-1.5 py-0.5 ml-1">for venues</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-text-medium hover:text-text">Home &amp; gigs</Link>
            <Link href="/today" className="text-text-medium hover:text-text">For artists</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-10">
        <div>
          <h1 className="font-display font-semibold tracking-tight text-2xl sm:text-3xl">{account.name}</h1>
          <p className="text-sm text-text-medium mt-1">{account.city}</p>
        </div>

        <SaveLinkNotice token={account.accessToken} isNew={searchParams.new === "1"} />

        <section>
          <h2 className="font-display font-semibold text-lg">Find an act for a night</h2>
          <p className="text-sm text-text-medium mt-1 mb-3">Pick a date to see who has nothing booked that day.</p>
          <FindActs token={account.accessToken} minDate={todayIso()} />
        </section>

        <section>
          <h2 className="font-display font-semibold text-lg">Nights you want filled</h2>
          <p className="text-sm text-text-medium mt-1 mb-3">Post a date and acts on Gigify can see it and offer to play. They&apos;ll see your venue name, town and email.</p>
          <OpenNights token={account.accessToken} minDate={todayIso()} nights={nights} />
        </section>

        <section>
          <h2 className="font-display font-semibold text-lg">Your bookings</h2>
          {account.bookings.length === 0 ? (
            <p className="text-sm text-text-medium mt-1">Nothing booked yet. Bookings you confirm from this page will appear here with their agreement.</p>
          ) : (
            <div className="mt-3 space-y-4">
              {upcoming.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-text-light mb-2">Upcoming</h3>
                  <ul className="border border-border rounded-xl bg-background divide-y divide-border">{upcoming.map((b) => bookingRow(b, false))}</ul>
                </div>
              )}
              {past.length > 0 && (
                <div>
                  <h3 className="text-xs uppercase tracking-wide text-text-light mb-2">Past</h3>
                  <ul className="border border-border rounded-xl bg-background divide-y divide-border">{past.map((b) => bookingRow(b, true))}</ul>
                </div>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
