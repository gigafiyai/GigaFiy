"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight, Check } from "lucide-react";

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

  // "Lost your link?" — emails the link(s) to the address on the venue page.
  const [recovering, setRecovering] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function recover(e: React.FormEvent) {
    e.preventDefault();
    setRecoverBusy(true);
    setRecoverMsg(null);
    try {
      const res = await fetch("/api/venue-accounts/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: recoverEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setRecoverMsg({ ok: true, text: "If that address has a venue page, the link is on its way. Check your inbox in a minute." });
    } catch (err) {
      setRecoverMsg({ ok: false, text: err instanceof Error ? err.message : "Something went wrong. Please try again." });
    } finally {
      setRecoverBusy(false);
    }
  }

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
      <p className="text-xs text-text-light mt-3">
        Free. No password: you get a private link to your page.{" "}
        {!recovering && (
          <button type="button" onClick={() => setRecovering(true)} className="text-accent-blue hover:underline">Lost your link?</button>
        )}
      </p>
      {recovering && (
        <form onSubmit={recover} className="mt-3 pt-3 border-t border-border">
          <p className="text-sm text-text">Get your link by email</p>
          <div className="mt-2 flex flex-col sm:flex-row gap-2">
            <input required type="email" value={recoverEmail} onChange={(e) => setRecoverEmail(e.target.value)} placeholder="The email you set up with" aria-label="Email you set up with" className={`${field} flex-1`} />
            <button type="submit" disabled={recoverBusy} className="px-4 py-2.5 rounded-lg border border-border bg-surface text-sm font-medium text-text hover:bg-surface-hover disabled:opacity-50 flex items-center justify-center gap-2">
              {recoverBusy && <Loader2 size={14} className="animate-spin" />} Email me my link
            </button>
          </div>
          {recoverMsg && (
            <p className={`text-xs mt-2 flex items-start gap-1.5 ${recoverMsg.ok ? "text-success-green" : "text-amber"}`}>
              {recoverMsg.ok && <Check size={12} className="mt-0.5 shrink-0" />} {recoverMsg.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
