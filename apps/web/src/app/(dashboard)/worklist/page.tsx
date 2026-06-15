"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Loader2, MapPin, CalendarDays, ChevronRight, Clock, X, Check } from "lucide-react";
import { CallPrepModal } from "@/components/outreach/call-prep-modal";
import { EmailDraftModal } from "@/components/outreach/email-draft-modal";

type Action = {
  kind: "NEW" | "WARM" | "FOLLOW_UP" | "WAITING" | "SNOOZED" | "DONE";
  channel: "CALL" | "EMAIL" | null;
  label: string;
  reason: string;
  dueAt: number;
  due: boolean;
  urgency: number;
};

type Venue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venueType: string;
  phone: string | null;
  email: string | null;
  decisionMakerName: string | null;
  leadTier: string | null;
  leadScore: number;
  leadReason: string | null;
  distanceMiles: number | null;
  canCall: boolean;
  canEmail: boolean;
  action: Action;
};

type TodayCard = Venue & { showId: string; showName: string };

type Show = {
  id: string;
  venueName: string;
  city: string;
  state: string;
  dayOfWeek: string;
  date: string;
  counts: { due: number; call: number; email: number; total: number };
  venues: Venue[];
};

const TIER_COLOR: Record<string, string> = {
  A: "text-success-green bg-success-green-bg border-success-green/20",
  B: "text-accent-blue bg-accent-blue-bg border-accent-blue/20",
  C: "text-text-medium bg-surface border-border",
  D: "text-text-light bg-surface border-border",
};

const KIND_BADGE: Record<Action["kind"], { label: string; cls: string }> = {
  WARM: { label: "Warm", cls: "text-success-green bg-success-green-bg border-success-green/20" },
  FOLLOW_UP: { label: "Follow up", cls: "text-purple bg-purple/10 border-purple/20" },
  NEW: { label: "New", cls: "text-accent-blue bg-accent-blue-bg border-accent-blue/20" },
  WAITING: { label: "Waiting", cls: "text-text-light bg-surface border-border" },
  SNOOZED: { label: "Snoozed", cls: "text-text-light bg-surface border-border" },
  DONE: { label: "Done", cls: "text-text-light bg-surface border-border" },
};

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WorklistPage() {
  const [today, setToday] = useState<TodayCard[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"today" | "shows">("today");
  const [open, setOpen] = useState<string | null>(null);
  const [callVenue, setCallVenue] = useState<Venue | null>(null);
  const [emailVenue, setEmailVenue] = useState<Venue | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const d = await fetch("/api/outreach/worklist").then((r) => r.json());
    if (d.ok) {
      setToday(d.today);
      setShows(d.shows);
      setOpen((cur) => cur ?? d.shows[0]?.id ?? null);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function snooze(venueId: string, action: "snooze" | "dismiss", days?: number) {
    setBusy(venueId);
    await fetch("/api/outreach/worklist/snooze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId, action, days }),
    }).catch(() => {});
    setBusy(null);
    load();
  }

  function act(v: Venue) {
    if (v.action.channel === "CALL") setCallVenue(v);
    else if (v.action.channel === "EMAIL") setEmailVenue(v);
  }

  function ActionRow({ v, showName }: { v: Venue; showName?: string }) {
    const badge = KIND_BADGE[v.action.kind];
    return (
      <div className="flex items-center gap-3 px-4 py-2.5">
        <span className={`text-[10px] font-semibold w-5 h-5 rounded flex items-center justify-center border shrink-0 ${TIER_COLOR[v.leadTier ?? "C"] ?? TIER_COLOR.C}`}>
          {v.leadTier ?? "—"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm text-text truncate">{v.name}</p>
            <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${badge.cls}`}>{badge.label}</span>
          </div>
          <p className="text-xs text-text-light truncate">
            {v.action.reason}
            {showName && ` · near ${showName}`}
            {v.distanceMiles != null && ` · ${Math.round(v.distanceMiles)}mi`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {v.action.channel && (
            <Button variant="primary" size="sm" onClick={() => act(v)} disabled={busy === v.id}>
              {v.action.channel === "CALL" ? <Phone size={12} /> : <Mail size={12} />} {v.action.label}
            </Button>
          )}
          <button
            type="button" title="Snooze 1 week" onClick={() => snooze(v.id, "snooze", 7)} disabled={busy === v.id}
            className="text-text-light hover:text-text p-1 rounded hover:bg-surface-hover"
          >
            <Clock size={13} />
          </button>
          <button
            type="button" title="Not a fit — remove" onClick={() => snooze(v.id, "dismiss")} disabled={busy === v.id}
            className="text-text-light hover:text-text p-1 rounded hover:bg-surface-hover"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    );
  }

  const dueCall = today.filter((c) => c.action.channel === "CALL").length;
  const dueEmail = today.filter((c) => c.action.channel === "EMAIL").length;

  return (
    <div className="flex flex-col h-full">
      <Header title="Worklist" description="Your daily call & email list. We rank the venues near your shows and resurface them at the right time — you make the contact." />

      <div className="px-6 pt-4">
        <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
          <button onClick={() => setTab("today")} className={`text-sm px-3 py-1 rounded-md ${tab === "today" ? "bg-background text-text shadow-sm" : "text-text-medium"}`}>
            Today {today.length > 0 && <span className="text-xs text-text-light">({today.length})</span>}
          </button>
          <button onClick={() => setTab("shows")} className={`text-sm px-3 py-1 rounded-md ${tab === "shows" ? "bg-background text-text shadow-sm" : "text-text-medium"}`}>
            By show
          </button>
        </div>
      </div>

      <div className="p-6 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="text-sm text-text-light flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Building today&apos;s list…</div>
        ) : shows.length === 0 ? (
          <div className="text-sm text-text-light border border-border rounded-lg p-6 text-center">
            No upcoming confirmed shows yet. Add a show on your <span className="text-text-medium">Schedule</span> and we&apos;ll route nearby venues here.
          </div>
        ) : tab === "today" ? (
          <>
            <div className="flex gap-3">
              <div className="flex-1 border border-border rounded-lg px-4 py-3 bg-background">
                <p className="text-xs text-text-light flex items-center gap-1.5"><Check size={12} /> Due today</p>
                <p className="text-2xl font-semibold text-text mt-0.5">{today.length}</p>
              </div>
              <div className="flex-1 border border-border rounded-lg px-4 py-3 bg-background">
                <p className="text-xs text-text-light flex items-center gap-1.5"><Phone size={12} /> Calls</p>
                <p className="text-2xl font-semibold text-text mt-0.5">{dueCall}</p>
              </div>
              <div className="flex-1 border border-border rounded-lg px-4 py-3 bg-background">
                <p className="text-xs text-text-light flex items-center gap-1.5"><Mail size={12} /> Emails</p>
                <p className="text-2xl font-semibold text-text mt-0.5">{dueEmail}</p>
              </div>
            </div>

            {today.length === 0 ? (
              <div className="text-sm text-text-light border border-border rounded-lg p-6 text-center">
                🎉 You&apos;re all caught up. New leads and follow-ups will appear here as they come due — check the <button onClick={() => setTab("shows")} className="text-accent-blue hover:underline">By show</button> tab to work ahead.
              </div>
            ) : (
              <div className="border border-border rounded-lg bg-background divide-y divide-border">
                {today.map((c) => <ActionRow key={c.id} v={c} showName={c.showName} />)}
              </div>
            )}
          </>
        ) : (
          shows.map((s) => {
            const expanded = open === s.id;
            return (
              <div key={s.id} className="border border-border rounded-lg bg-background overflow-hidden">
                <button type="button" onClick={() => setOpen(expanded ? null : s.id)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover text-left">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text truncate">{s.venueName}</p>
                    <p className="text-xs text-text-light flex items-center gap-1 mt-0.5">
                      <MapPin size={11} /> {s.city}, {s.state} · {s.dayOfWeek} {prettyDate(s.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {s.counts.due > 0 && <span className="text-xs text-success-green flex items-center gap-1"><CalendarDays size={11} /> {s.counts.due} due</span>}
                    <span className="text-xs text-text-light">{s.counts.total} venues</span>
                    <ChevronRight size={15} className={`text-text-light transition-transform ${expanded ? "rotate-90" : ""}`} />
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {s.venues.length === 0 && <p className="px-4 py-3 text-xs text-text-light">No ranked venues routed to this show yet.</p>}
                    {s.venues.map((v) => <ActionRow key={v.id} v={v} />)}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {callVenue && <CallPrepModal venueId={callVenue.id} onClose={() => setCallVenue(null)} onLogged={load} />}
      {emailVenue && (
        <EmailDraftModal
          venueId={emailVenue.id}
          venueName={emailVenue.name}
          email={emailVenue.email}
          onClose={() => setEmailVenue(null)}
          onLogged={load}
        />
      )}
    </div>
  );
}
