"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Loader2, MapPin, CalendarDays, ChevronRight } from "lucide-react";
import { CallPrepModal } from "@/components/outreach/call-prep-modal";
import { EmailDraftModal } from "@/components/outreach/email-draft-modal";

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
  lastOutreach: string | null;
  lastCall: string | null;
};

type Show = {
  id: string;
  venueName: string;
  city: string;
  state: string;
  dayOfWeek: string;
  date: string;
  counts: { call: number; email: number; highRanked: number };
  venues: Venue[];
};

const TIER_COLOR: Record<string, string> = {
  A: "text-success-green bg-success-green-bg border-success-green/20",
  B: "text-accent-blue bg-accent-blue-bg border-accent-blue/20",
  C: "text-text-medium bg-surface border-border",
  D: "text-text-light bg-surface border-border",
};

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function WorklistPage() {
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [callVenue, setCallVenue] = useState<Venue | null>(null);
  const [emailVenue, setEmailVenue] = useState<Venue | null>(null);

  async function load() {
    const d = await fetch("/api/outreach/worklist").then((r) => r.json());
    if (d.ok) {
      setShows(d.shows);
      setOpen((cur) => cur ?? d.shows[0]?.id ?? null);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const totalCall = shows.reduce((n, s) => n + s.counts.call, 0);
  const totalEmail = shows.reduce((n, s) => n + s.counts.email, 0);

  return (
    <div className="flex flex-col h-full">
      <Header title="Worklist" description="Your routed venues — call the strong ones, email the rest. You make the contact; we do the homework." />

      <div className="p-6 space-y-4 overflow-y-auto">
        {loading ? (
          <div className="text-sm text-text-light flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Routing venues to your shows…</div>
        ) : shows.length === 0 ? (
          <div className="text-sm text-text-light border border-border rounded-lg p-6 text-center">
            No upcoming confirmed shows yet. Add a show on your <span className="text-text-medium">Schedule</span> and we&apos;ll route nearby venues here.
          </div>
        ) : (
          <>
            <div className="flex gap-3">
              <div className="flex-1 border border-border rounded-lg px-4 py-3 bg-background">
                <p className="text-xs text-text-light flex items-center gap-1.5"><Phone size={12} /> Ready to call</p>
                <p className="text-2xl font-semibold text-text mt-0.5">{totalCall}</p>
              </div>
              <div className="flex-1 border border-border rounded-lg px-4 py-3 bg-background">
                <p className="text-xs text-text-light flex items-center gap-1.5"><Mail size={12} /> Email-only</p>
                <p className="text-2xl font-semibold text-text mt-0.5">{totalEmail}</p>
              </div>
              <div className="flex-1 border border-border rounded-lg px-4 py-3 bg-background">
                <p className="text-xs text-text-light flex items-center gap-1.5"><CalendarDays size={12} /> Upcoming shows</p>
                <p className="text-2xl font-semibold text-text mt-0.5">{shows.length}</p>
              </div>
            </div>

            {shows.map((s) => {
              const expanded = open === s.id;
              return (
                <div key={s.id} className="border border-border rounded-lg bg-background overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : s.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{s.venueName}</p>
                      <p className="text-xs text-text-light flex items-center gap-1 mt-0.5">
                        <MapPin size={11} /> {s.city}, {s.state} · {s.dayOfWeek} {prettyDate(s.date)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.counts.call > 0 && <span className="text-xs text-text-medium flex items-center gap-1"><Phone size={11} className="text-success-green" /> {s.counts.call}</span>}
                      {s.counts.email > 0 && <span className="text-xs text-text-medium flex items-center gap-1"><Mail size={11} className="text-accent-blue" /> {s.counts.email}</span>}
                      <ChevronRight size={15} className={`text-text-light transition-transform ${expanded ? "rotate-90" : ""}`} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-border divide-y divide-border">
                      {s.venues.length === 0 && <p className="px-4 py-3 text-xs text-text-light">No ranked venues routed to this show yet.</p>}
                      {s.venues.map((v) => (
                        <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className={`text-[10px] font-semibold w-5 h-5 rounded flex items-center justify-center border shrink-0 ${TIER_COLOR[v.leadTier ?? "C"] ?? TIER_COLOR.C}`}>
                            {v.leadTier ?? "—"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-text truncate">{v.name}</p>
                            <p className="text-xs text-text-light truncate">
                              {v.city}, {v.state}
                              {v.distanceMiles != null && ` · ${Math.round(v.distanceMiles)}mi`}
                              {v.leadReason && ` · ${v.leadReason}`}
                            </p>
                          </div>
                          {(v.lastCall || v.lastOutreach) && (
                            <span className="text-[10px] text-text-light shrink-0">{v.lastCall ? "called" : "emailed"}</span>
                          )}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {v.canCall && (
                              <Button variant="default" size="sm" onClick={() => setCallVenue(v)}>
                                <Phone size={12} /> Call
                              </Button>
                            )}
                            {v.canEmail && (
                              <Button variant={v.canCall ? "ghost" : "default"} size="sm" onClick={() => setEmailVenue(v)}>
                                <Mail size={12} /> Email
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
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
