"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Phone, Mail, Loader2, Check, ChevronRight, Clock, X, Share2, Copy, MessageSquare, ArrowLeft, Sparkles,
} from "lucide-react";
import { EmailDraftModal } from "@/components/outreach/email-draft-modal";

type Action = {
  kind: "NEW" | "WARM" | "FOLLOW_UP" | "WAITING" | "SNOOZED" | "DONE";
  channel: "CALL" | "EMAIL" | null;
  label: string;
  reason: string;
};

type Card = {
  id: string;
  name: string;
  city: string;
  state: string;
  phone: string | null;
  email: string | null;
  decisionMakerName: string | null;
  leadTier: string | null;
  leadReason: string | null;
  distanceMiles: number | null;
  showName: string;
  action: Action;
};

type ShowLite = { id: string; venueName: string; city: string; state: string; date: string };

type Brief = {
  firstLine: string;
  knowledge: { artistFacts: string[]; proofPoints: string[]; venueFacts: string[]; theOffer: string[] };
};

const KIND_LABEL: Record<Action["kind"], string> = {
  WARM: "Warm", FOLLOW_UP: "Follow up", NEW: "New", WAITING: "Waiting", SNOOZED: "Snoozed", DONE: "Done",
};

// A daily session should be finishable; the rest stays in the full venue list.
const DAILY_LIMIT = 12;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function daysUntil(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((new Date(y, m - 1, d).getTime() - start) / 86_400_000);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

export default function TodayPage() {
  const [queue, setQueue] = useState<Card[]>([]);
  const [shows, setShows] = useState<ShowLite[]>([]);
  const [artistName, setArtistName] = useState("");
  const [loading, setLoading] = useState(true);
  const [dueTotal, setDueTotal] = useState(0);
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [tally, setTally] = useState({ calls: 0, emails: 0, skipped: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/outreach/worklist").then((r) => r.json()),
      fetch("/api/artist").then((r) => r.json()).catch(() => null),
    ]).then(([w, a]) => {
      if (w?.ok) {
        // Freeze today's queue at load so the list doesn't reshuffle mid-session.
        setQueue(w.today.slice(0, DAILY_LIMIT));
        setDueTotal(w.dueTotal ?? w.today.length);
        setShows(w.shows);
      }
      if (a?.name) setArtistName(a.name);
      setLoading(false);
    });
  }, []);

  const firstName = artistName.split(" ")[0] || "there";
  const counts = useMemo(
    () => ({
      warm: queue.filter((c) => c.action.kind === "WARM").length,
      followUp: queue.filter((c) => c.action.kind === "FOLLOW_UP").length,
      fresh: queue.filter((c) => c.action.kind === "NEW").length,
      calls: queue.filter((c) => c.action.channel === "CALL").length,
    }),
    [queue]
  );
  const nextShow = shows[0];

  function advance(kind: "calls" | "emails" | "skipped") {
    setTally((t) => ({ ...t, [kind]: t[kind] + 1 }));
    setIndex((i) => i + 1);
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-sm text-text-light flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Preparing your day…</p>
      </Shell>
    );
  }

  // ── Wrap-up ──
  if (started && index >= queue.length) {
    return (
      <Shell>
        <Check size={32} className="text-success-green" />
        <h1 className="text-2xl font-semibold font-display mt-3">That&apos;s the list, {firstName}.</h1>
        <p className="text-sm text-text-medium mt-2">
          {plural(tally.calls, "call")} and {plural(tally.emails, "email")} done
          {tally.skipped > 0 ? `, ${tally.skipped} skipped` : ""}. Follow-ups will come back on their own when they&apos;re due.
        </p>
        <Link href="/worklist" className="mt-6 inline-flex items-center gap-1.5 text-sm text-accent-blue">
          Work ahead in the full list <ChevronRight size={14} />
        </Link>
      </Shell>
    );
  }

  // ── Briefing ──
  if (!started) {
    return (
      <Shell>
        <p className="text-xs uppercase tracking-wide text-accent-blue flex items-center gap-1.5"><Sparkles size={12} /> Today</p>
        <h1 className="text-3xl font-semibold font-display mt-2">{greeting()}, {firstName}.</h1>

        {queue.length === 0 ? (
          <>
            <p className="text-base text-text-medium mt-4">
              Nothing is due today. Follow-ups will show up here when their time comes.
            </p>
            <Link href="/worklist" className="mt-6 inline-flex items-center gap-1.5 text-sm text-accent-blue">
              Work ahead in the full list <ChevronRight size={14} />
            </Link>
          </>
        ) : (
          <>
            <p className="text-base text-text-medium mt-4 leading-relaxed">
              I have {plural(queue.length, "venue")} ranked and ready for you
              {counts.calls > 0 ? `, ${plural(counts.calls, "call")} among them` : ""}. About {Math.max(5, queue.length * 4)} minutes.
              {dueTotal > queue.length ? ` These are the top ${queue.length} of ${dueTotal} due.` : ""}
            </p>

            <div className="mt-5 w-full grid grid-cols-3 gap-2">
              <Stat n={counts.warm} label="Warm" tone="text-success-green" />
              <Stat n={counts.followUp} label="Follow-ups" tone="text-purple" />
              <Stat n={counts.fresh} label="New" tone="text-accent-blue" />
            </div>

            {!nextShow && (
              <p className="text-sm text-text-light mt-5">
                No upcoming shows on your schedule, so I&apos;ll pitch these without a &ldquo;playing nearby&rdquo; date.{" "}
                <Link href="/schedule" className="text-accent-blue">Add a show</Link> and I&apos;ll route around it.
              </p>
            )}
            {nextShow && (
              <p className="text-sm text-text-light mt-5">
                Next show: <span className="text-text-medium">{nextShow.venueName}</span>, {nextShow.city}
                {(() => {
                  const d = daysUntil(nextShow.date);
                  return d === 0 ? " — today" : d === 1 ? " — tomorrow" : ` — in ${d} days`;
                })()}
              </p>
            )}

            <div className="mt-5 w-full border border-border rounded-lg bg-surface divide-y divide-border">
              {queue.slice(0, 3).map((c, i) => (
                <div key={c.id} className="px-3 py-2.5 flex items-center gap-3">
                  <span className="text-xs text-text-light w-4">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text truncate">{c.name}</p>
                    <p className="text-xs text-text-light truncate">{c.action.reason}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-text-light shrink-0">{KIND_LABEL[c.action.kind]}</span>
                </div>
              ))}
              {queue.length > 3 && <p className="px-3 py-2 text-xs text-text-light">and {queue.length - 3} more</p>}
            </div>

            <button
              type="button"
              onClick={() => setStarted(true)}
              className="mt-6 w-full bg-accent-blue text-white py-3.5 rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2"
            >
              Start <ChevronRight size={16} />
            </button>
          </>
        )}
      </Shell>
    );
  }

  // ── Session ──
  const card = queue[index];
  return (
    <Shell wide>
      <div className="w-full flex items-center justify-between text-xs text-text-light mb-3">
        <span>{index + 1} of {queue.length}</span>
        <span>{KIND_LABEL[card.action.kind]} · {card.action.reason}</span>
      </div>
      <div className="w-full h-1 bg-surface rounded-full overflow-hidden mb-5">
        <div className="h-full bg-accent-blue transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      <VenueStep key={card.id} card={card} artistName={artistName} onDone={advance} />
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-4 py-3 flex items-center justify-between border-b border-border">
        <Link href="/worklist" className="text-xs text-text-light flex items-center gap-1 hover:text-text">
          <ArrowLeft size={13} /> All venues
        </Link>
        <Link href="/" className="font-display font-semibold text-sm hover:text-accent-blue" title="Gigify home">Gigify</Link>
        <Link href="/" className="text-xs text-text-light hover:text-text w-14 text-right">Home</Link>
      </div>
      <div className={`flex-1 w-full mx-auto px-5 py-8 flex flex-col items-start ${wide ? "max-w-xl" : "max-w-md justify-center"}`}>
        {children}
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className="border border-border rounded-lg px-3 py-2.5 bg-background">
      <p className={`text-2xl font-semibold ${n > 0 ? tone : "text-text-light"}`}>{n}</p>
      <p className="text-xs text-text-light">{label}</p>
    </div>
  );
}

// One venue: talking points → call (or email) → log the outcome → send the page → next.
function VenueStep({
  card,
  artistName,
  onDone,
}: {
  card: Card;
  artistName: string;
  onDone: (kind: "calls" | "emails" | "skipped") => void;
}) {
  const isCall = card.action.channel === "CALL" && !!card.phone;
  const [brief, setBrief] = useState<Brief | null>(null);
  const [bookingLink, setBookingLink] = useState<string | null>(null);
  const [opener, setOpener] = useState<string | null>(null);
  const [phase, setPhase] = useState<"prep" | "logged">("prep");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
    fetch(`/api/calls/brief?venueId=${card.id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          setBrief(d.brief);
          setBookingLink(d.bookingLink ?? null);
          setOpener(d.humanOpener ?? null);
        }
      })
      .catch(() => {});
  }, [card.id]);

  async function logCall(outcome: "ANSWERED" | "VOICEMAIL" | "NO_ANSWER") {
    setBusy(true);
    await fetch("/api/calls/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: card.id, outcome, transcript: note.trim() || undefined }),
    }).catch(() => {});
    setBusy(false);
    // Only a real conversation earns the "send your page" step.
    if (outcome === "ANSWERED") setPhase("logged");
    else onDone("calls");
  }

  async function housekeeping(action: "snooze" | "dismiss") {
    setBusy(true);
    await fetch("/api/outreach/worklist/snooze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId: card.id, action, days: 7 }),
    }).catch(() => {});
    setBusy(false);
    onDone("skipped");
  }

  const firstName = artistName.split(" ")[0] || "me";
  const message = bookingLink
    ? `Hi${card.decisionMakerName ? ` ${card.decisionMakerName.split(" ")[0]}` : ""}, it's ${artistName || firstName} — good talking with you. Here's my page with a short reel, my dates near you and a one-tap way to hold a date: ${bookingLink}`
    : "";

  async function share() {
    try {
      await navigator.share({ title: `${artistName} — booking`, text: message });
    } catch {
      /* user closed the share sheet */
    }
  }
  async function copy() {
    await navigator.clipboard.writeText(message).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const points = brief
    ? [...brief.knowledge.venueFacts.slice(0, 2), ...brief.knowledge.proofPoints.slice(0, 1), ...brief.knowledge.theOffer.slice(0, 2)]
    : [];

  return (
    <div className="w-full">
      <div className="flex items-start gap-3">
        <span className="text-xs font-semibold w-7 h-7 rounded-md flex items-center justify-center border border-border bg-surface shrink-0">
          {card.leadTier ?? "—"}
        </span>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold font-display leading-tight">{card.name}</h2>
          <p className="text-sm text-text-light mt-0.5">
            {card.city}, {card.state}
            {card.distanceMiles != null && card.showName && ` · ${Math.round(card.distanceMiles)} mi from ${card.showName}`}
            {card.decisionMakerName && ` · ask for ${card.decisionMakerName}`}
          </p>
        </div>
      </div>

      {phase === "prep" && (
        <>
          <div className="mt-5 border border-border rounded-lg bg-surface p-4 space-y-3">
            {!brief ? (
              <p className="text-sm text-text-light flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Pulling your talking points…</p>
            ) : (
              <>
                {isCall && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-text-light mb-1">Open with</p>
                    <p className="text-sm text-text italic">&ldquo;{opener ?? brief.firstLine}&rdquo;</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-text-light mb-1">Know before you {isCall ? "dial" : "write"}</p>
                  <ul className="space-y-1">
                    {points.map((p, i) => <li key={i} className="text-sm text-text leading-snug">• {p}</li>)}
                  </ul>
                </div>
              </>
            )}
          </div>

          {isCall ? (
            <>
              <a
                href={`tel:${card.phone}`}
                className="mt-4 w-full bg-accent-blue text-white py-3.5 rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2"
              >
                <Phone size={16} /> Call {card.phone}
              </a>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="How did it go? A line or two helps me rank the follow-up. (optional)"
                className="mt-4 w-full px-3 py-2 text-sm bg-elevated border border-border rounded-md text-text focus:outline-none focus:border-accent-blue resize-y placeholder:text-text-light"
              />
              <div className="mt-2 grid grid-cols-3 gap-2">
                {([["ANSWERED", "We talked"], ["VOICEMAIL", "Voicemail"], ["NO_ANSWER", "No answer"]] as const).map(([o, label]) => (
                  <button
                    key={o} type="button" disabled={busy} onClick={() => logCall(o)}
                    className="border border-border rounded-lg py-2.5 text-sm text-text bg-background hover:bg-surface-hover disabled:opacity-50"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setEmailOpen(true)}
              className="mt-4 w-full bg-accent-blue text-white py-3.5 rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2"
            >
              <Mail size={16} /> Write the email
            </button>
          )}

          <div className="mt-5 flex items-center gap-4 text-xs text-text-light">
            <button type="button" disabled={busy} onClick={() => onDone("skipped")} className="hover:text-text">Skip for now</button>
            <button type="button" disabled={busy} onClick={() => housekeeping("snooze")} className="hover:text-text flex items-center gap-1"><Clock size={12} /> Snooze a week</button>
            <button type="button" disabled={busy} onClick={() => housekeeping("dismiss")} className="hover:text-text flex items-center gap-1"><X size={12} /> Not a fit</button>
          </div>
        </>
      )}

      {phase === "logged" && (
        <div className="mt-5">
          <p className="text-sm text-success-green flex items-center gap-1.5"><Check size={14} /> Logged.</p>
          <div className="mt-3 border border-border rounded-lg bg-surface p-4">
            <p className="text-sm font-medium text-text">Send them your page while it&apos;s fresh</p>
            <p className="text-xs text-text-light mt-1">Reel, your dates near them and a one-tap way to hold the date. No fees for them or you.</p>
            {message && <p className="text-xs text-text-medium mt-3 border-l-2 border-border pl-3 leading-relaxed">{message}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {canShare && (
                <button type="button" onClick={share} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md bg-accent-blue text-white hover:opacity-90">
                  <Share2 size={13} /> Share
                </button>
              )}
              {card.phone && (
                <a href={`sms:${card.phone}?&body=${encodeURIComponent(message)}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border bg-background text-text hover:bg-surface-hover">
                  <MessageSquare size={13} /> Text
                </a>
              )}
              {card.email && (
                <a
                  href={`mailto:${card.email}?subject=${encodeURIComponent(`${artistName} — booking details`)}&body=${encodeURIComponent(message)}`}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border bg-background text-text hover:bg-surface-hover"
                >
                  <Mail size={13} /> Email
                </a>
              )}
              <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-md border border-border bg-background text-text hover:bg-surface-hover">
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDone("calls")}
            className="mt-4 w-full border border-border rounded-lg py-3 text-sm font-medium text-text bg-background hover:bg-surface-hover flex items-center justify-center gap-1.5"
          >
            Next venue <ChevronRight size={15} />
          </button>
        </div>
      )}

      {emailOpen && (
        <EmailDraftModal
          venueId={card.id}
          venueName={card.name}
          email={card.email}
          onClose={() => setEmailOpen(false)}
          onLogged={() => { setEmailOpen(false); onDone("emails"); }}
        />
      )}
    </div>
  );
}
