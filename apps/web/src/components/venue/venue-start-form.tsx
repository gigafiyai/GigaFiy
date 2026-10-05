"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";

const KEY = "gigify-venue-token";

// Creates a venue workspace and goes straight to it. If this browser already
// has one, offer the way back instead of making a second.
export function VenueStartForm({ referredBy }: { referredBy?: string }) {
  const [existing, setExisting] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try { setExisting(localStorage.getItem(KEY)); } catch { /* storage unavailable */ }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/venue-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, city, contactName: contactName || undefined, email, ref: referredBy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      try { localStorage.setItem(KEY, data.token); } catch { /* ignore */ }
      window.location.href = `/venue/${data.token}?new=1`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  const field = "px-3 py-2.5 text-sm bg-elevated border border-border rounded-lg text-text focus:outline-none focus:border-accent-blue placeholder:text-text-light";

  return (
    <div className="border border-border rounded-xl bg-background p-5">
      {existing && (
        <Link href={`/venue/${existing}`} className="mb-4 flex items-center justify-between gap-3 border border-accent-blue/30 bg-accent-blue-bg rounded-lg px-4 py-3 text-sm text-text hover:opacity-90">
          You already have a venue page on this device <span className="text-accent-blue flex items-center gap-1 shrink-0">Open it <ArrowRight size={14} /></span>
        </Link>
      )}
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Venue name" aria-label="Venue name" className={field} />
        <input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="Town, state" aria-label="Town and state" className={field} />
        <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" aria-label="Your name" className={field} />
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourvenue.com" aria-label="Email" className={field} />
        <button type="submit" disabled={busy} className="sm:col-span-2 mt-1 px-5 py-3 rounded-lg bg-accent-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy && <Loader2 size={14} className="animate-spin" />} Create my venue page
        </button>
      </form>
      {error && <p className="text-xs text-amber mt-2">{error}</p>}
      <p className="text-xs text-text-light mt-3">Free. No password: you get a private link to your page.</p>
    </div>
  );
}
