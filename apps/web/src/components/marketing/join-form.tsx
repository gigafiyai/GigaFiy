"use client";

import { useState } from "react";
import { Check, Copy, Loader2, Share2 } from "lucide-react";

type Role = "fan" | "venue" | "artist";

const ROLES: { id: Role; label: string; pitch: string; cityLabel: string }[] = [
  { id: "fan", label: "I go to shows", pitch: "See what's on near you and be first to know when new nights are added.", cityLabel: "Your town" },
  { id: "venue", label: "I run a venue", pitch: "Browse acts near you, see their dates and hold a night in one tap. No booking fees.", cityLabel: "Venue town" },
  { id: "artist", label: "I perform", pitch: "Get a booking page, a daily list of venues to contact, and keep 100% of every fee.", cityLabel: "Where you're based" },
];

// Early-access sign-up for all three audiences. After joining, the person gets
// a share link; sign-ups through it are counted against their code.
export function JoinForm({ referredBy, defaultCity }: { referredBy?: string; defaultCity?: string }) {
  const [role, setRole] = useState<Role>("fan");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState(defaultCity ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ refCode: string; referrals: number; returning: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const active = ROLES.find((r) => r.id === role)!;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, city: city || undefined, ref: referredBy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const link = `${window.location.origin}/?r=${result.refCode}`;
    const text = "Live gigs near you, and an easy way for venues to book local acts:";
    const canShare = typeof navigator.share === "function";
    return (
      <div className="border border-border rounded-xl bg-background p-5">
        <p className="text-base font-medium text-text flex items-center gap-2">
          <Check size={16} className="text-success-green" /> {result.returning ? "Welcome back — you're already on the list." : "You're on the list."}
        </p>
        <p className="text-sm text-text-medium mt-2">
          Know a venue that should have live music, or an act that should be playing more? Send them your link.
          {result.referrals > 0 ? ` ${result.referrals} ${result.referrals === 1 ? "person has" : "people have"} joined through it so far.` : ""}
        </p>
        <div className="mt-3 flex items-center gap-2 border border-border rounded-lg bg-surface px-3 py-2">
          <code className="text-xs text-text-medium truncate flex-1">{link}</code>
          <button
            type="button"
            onClick={async () => { await navigator.clipboard.writeText(link).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="text-xs text-text flex items-center gap-1 shrink-0 hover:text-accent-blue"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
          </button>
          {canShare && (
            <button
              type="button"
              onClick={() => navigator.share({ title: "Gigify", text, url: link }).catch(() => {})}
              className="text-xs text-text flex items-center gap-1 shrink-0 hover:text-accent-blue"
            >
              <Share2 size={12} /> Share
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-border rounded-xl bg-background p-5">
      <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-surface border border-border">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRole(r.id)}
            className={`text-xs sm:text-sm py-2 rounded-md transition-colors ${role === r.id ? "bg-background text-text font-medium shadow-sm border border-border" : "text-text-medium hover:text-text"}`}
          >
            {r.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-text-medium mt-3 min-h-[2.5rem]">{active.pitch}</p>
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email"
          className="px-3 py-2.5 text-sm bg-elevated border border-border rounded-lg text-text focus:outline-none focus:border-accent-blue placeholder:text-text-light"
        />
        <input
          value={city} onChange={(e) => setCity(e.target.value)} placeholder={active.cityLabel} aria-label={active.cityLabel}
          className="px-3 py-2.5 text-sm bg-elevated border border-border rounded-lg text-text focus:outline-none focus:border-accent-blue placeholder:text-text-light"
        />
        <button
          type="submit" disabled={busy}
          className="px-5 py-2.5 rounded-lg bg-accent-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {busy && <Loader2 size={14} className="animate-spin" />} Get early access
        </button>
      </div>
      {error && <p className="text-xs text-amber mt-2">{error}</p>}
      <p className="text-xs text-text-light mt-3">We&apos;ll only email you about Gigify in your area.</p>
    </form>
  );
}
