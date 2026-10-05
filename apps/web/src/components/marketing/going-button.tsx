"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Share2, Users } from "lucide-react";

// "I'm going" for a public gig page. Asks for an email once (so we can count
// real people and let them know if the show changes), then offers a share link.
export function GoingButton({
  showId,
  initialGoing,
  shareTitle,
  referredBy,
}: {
  showId: string;
  initialGoing: number;
  shareTitle: string;
  referredBy?: string;
}) {
  const storageKey = `gigify-going-${showId}`;
  const [going, setGoing] = useState(initialGoing);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refCode, setRefCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setRefCode(saved);
    } catch {
      /* storage unavailable */
    }
  }, [storageKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/gigs/${showId}/going`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ref: referredBy }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
      setGoing(data.going);
      setRefCode(data.refCode);
      try { localStorage.setItem(storageKey, data.refCode); } catch { /* ignore */ }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const count = (
    <p className="text-sm text-text-medium flex items-center gap-1.5">
      <Users size={14} className="text-text-light" />
      {going === 0 ? "Be the first to say you're going" : `${going} ${going === 1 ? "person is" : "people are"} going`}
    </p>
  );

  if (refCode) {
    const link = `${window.location.origin}/gigs/${showId}?r=${refCode}`;
    return (
      <div className="space-y-3">
        <p className="text-base font-medium text-success-green flex items-center gap-2"><Check size={16} /> You&apos;re going</p>
        {count}
        <p className="text-sm text-text-medium">Bring people. Send them this link:</p>
        <div className="flex items-center gap-2 border border-border rounded-lg bg-surface px-3 py-2">
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
              onClick={() => navigator.share({ title: shareTitle, text: shareTitle, url: link }).catch(() => {})}
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
    <div className="space-y-3">
      {count}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full sm:w-auto px-6 py-3 rounded-lg bg-accent-blue text-white font-medium hover:opacity-90"
        >
          I&apos;m going
        </button>
      ) : (
        <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email"
            className="flex-1 px-3 py-2.5 text-sm bg-elevated border border-border rounded-lg text-text focus:outline-none focus:border-accent-blue placeholder:text-text-light"
          />
          <button
            type="submit" disabled={busy}
            className="px-5 py-2.5 rounded-lg bg-accent-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 size={14} className="animate-spin" />} Count me in
          </button>
        </form>
      )}
      {open && <p className="text-xs text-text-light">Free. We&apos;ll only email you if this show changes or new ones are added nearby.</p>}
      {error && <p className="text-xs text-amber">{error}</p>}
    </div>
  );
}
