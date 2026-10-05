import Link from "next/link";
import { VenueStartForm } from "@/components/venue/venue-start-form";
import { CalendarPlus, Search, ShieldCheck, FileText } from "lucide-react";

export const metadata = {
  title: "Gigify for venues — fill your nights with live acts",
  description: "Find acts that are free on the night you need, hold the date in one tap, and keep every booking in one place. No booking fees.",
};

// The venue-side front door. Same marketplace as the fan and artist sides,
// seen from the venue's seat.
export default function VenuesPage({ searchParams }: { searchParams: { r?: string } }) {
  return (
    <div className="min-h-screen bg-background text-text">
      <header className="border-b border-border">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-gradient-to-br from-accent-blue to-purple flex items-center justify-center">
              <span className="text-white text-sm font-bold font-display">G</span>
            </span>
            <span className="font-display font-semibold text-lg tracking-tight">Gigify</span>
            <span className="text-xs text-text-light border border-border rounded px-1.5 py-0.5 ml-1">for venues</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-text-medium hover:text-text">Gigs near you</Link>
            <Link href="/today" className="text-text-medium hover:text-text">For artists</Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-border bg-surface">
        <div className="max-w-5xl mx-auto px-5 py-12 grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <h1 className="font-display font-semibold tracking-tight text-3xl sm:text-4xl leading-tight">
              Fill your nights with live acts, without the back-and-forth.
            </h1>
            <p className="text-base text-text-medium mt-4">
              Never hosted live music or comedy? Start with one night. See who&apos;s free, what they cost and what they sound like, then hold the date.
            </p>
            <ul className="mt-6 space-y-4">
              {[
                { icon: Search, title: "Find an act for a specific night", body: "Pick a date and see the acts with nothing on their calendar, with their reel and rate." },
                { icon: CalendarPlus, title: "Post the nights you want filled", body: "List an open Friday and a budget. Acts on Gigify see it and come to you." },
                { icon: FileText, title: "Every booking in one place", body: "Dates, fees and agreements, so nothing lives in a text thread." },
                { icon: ShieldCheck, title: "Low risk by design", body: "50% deposit or cash on the night, free cancellation for 24 hours, and no booking fees." },
              ].map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex gap-3">
                  <Icon size={18} className="text-accent-blue shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-text">{title}</p>
                    <p className="text-sm text-text-medium mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg mb-3">Set up your venue page</h2>
            <VenueStartForm referredBy={searchParams.r} />
          </div>
        </div>
      </section>
    </div>
  );
}
