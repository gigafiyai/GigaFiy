"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ChevronRight, Search, Loader2, Check, AlertCircle,
  Mail, Phone, Send, Zap,
} from "lucide-react";

type ShowVenue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venueType: string;
  decisionMakerName: string | null;
  distanceMiles: number | null;
  contactEmail: string | null;
  phone: string | null;
  leadTier: string | null;
  hostsLiveMusic: boolean | null;
  optedOut: boolean;
  emailStatus: string | null;
  pipelineId: string | null;
  pipelineStage: string | null;
};

type Show = {
  id: string;
  date: string;
  dayOfWeek: string;
  city: string;
  state: string;
  venueName: string;
  venuesDiscovered: number;
};

type Props = {
  show: Show;
  // Discovery (existing behavior — passed through)
  discoverResult: { inserted: number; updated: number } | { error: string } | undefined;
  enrichRow: { enriching?: boolean; enriched?: number; attempted?: number } | undefined;
  isDiscovering: boolean;
  disabled: boolean;
  onDiscover: () => void;
  onChanged: () => void; // refresh dashboard after sends
};

const TIER_COLORS: Record<string, string> = {
  A: "bg-success-green-bg text-success-green",
  B: "bg-accent-blue-bg text-accent-blue",
  C: "bg-amber-bg text-amber",
  D: "bg-surface text-text-light",
};

const STAGE_COLORS: Record<string, string> = {
  QUEUED: "text-text-light",
  EMAILED: "text-accent-blue",
  CALLED: "text-purple",
  INTERESTED: "text-purple",
  DEPOSIT: "text-amber",
  BOOKED: "text-success-green",
  DECLINED: "text-text-light",
};

export function ShowOutreachRow({ show, discoverResult, enrichRow, isDiscovering, disabled, onDiscover, onChanged }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [venues, setVenues] = useState<ShowVenue[] | null>(null);
  const [loadingVenues, setLoadingVenues] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  async function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && venues === null) {
      setLoadingVenues(true);
      try {
        const data = await fetch(`/api/shows/${show.id}/venues`).then((r) => r.json());
        setVenues(data);
      } finally {
        setLoadingVenues(false);
      }
    }
  }

  async function reloadVenues() {
    const data = await fetch(`/api/shows/${show.id}/venues`).then((r) => r.json());
    setVenues(data);
  }

  const queuedEmailable = (venues ?? []).filter(
    (v) => v.pipelineStage === "QUEUED" && v.contactEmail && !v.optedOut
  );

  async function sendToQueued() {
    if (queuedEmailable.length === 0) return;
    setSending(true);
    setSentMsg(null);
    try {
      const res = await fetch("/api/outreach/send-all-queued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineIds: queuedEmailable.map((v) => v.pipelineId) }),
      });
      const data = await res.json();
      setSentMsg(`Sent ${data.sent} · ${data.skippedNoEmail} skipped`);
      await reloadVenues();
      onChanged();
    } catch {
      setSentMsg("Send failed");
    } finally {
      setSending(false);
    }
  }

  async function sendOne(v: ShowVenue) {
    if (!v.pipelineId || !v.contactEmail) return;
    setSending(true);
    try {
      await fetch("/api/outreach/send-all-queued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineIds: [v.pipelineId] }),
      });
      await reloadVenues();
      onChanged();
    } finally {
      setSending(false);
    }
  }

  const prettyDate = new Date(show.date + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });

  return (
    <div>
      {/* Show header row */}
      <div className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors">
        <button type="button" onClick={toggle} className="flex items-center gap-4 min-w-0 flex-1 text-left">
          <ChevronRight size={14} className={`text-text-light shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
          <div className="w-12 text-center shrink-0">
            <p className="text-xs text-text-light uppercase">{show.dayOfWeek.slice(0, 3)}</p>
            <p className="text-sm font-medium text-text">{prettyDate}</p>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-text font-medium truncate">{show.city}, {show.state}</p>
            <p className="text-xs text-text-light truncate">{show.venueName}</p>
          </div>
        </button>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-text-light">
            {show.venuesDiscovered} venue{show.venuesDiscovered === 1 ? "" : "s"}
          </span>
          {enrichRow?.enriching && (
            <span className="flex items-center gap-1 text-xs text-accent-blue">
              <Loader2 size={11} className="animate-spin" /> enriching
            </span>
          )}
          {discoverResult && "error" in discoverResult && (
            <span className="text-xs text-amber flex items-center gap-1"><AlertCircle size={11} />err</span>
          )}
          {discoverResult && !("error" in discoverResult) && (
            <span className="text-xs text-success-green flex items-center gap-1">
              <Check size={11} />+{discoverResult.inserted}
            </span>
          )}
          <Button variant="default" size="sm" onClick={onDiscover} disabled={isDiscovering || disabled}>
            {isDiscovering ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}
            Discover
          </Button>
        </div>
      </div>

      {/* Expanded venue list */}
      {expanded && (
        <div className="bg-surface border-t border-border px-4 py-3">
          {loadingVenues ? (
            <p className="text-xs text-text-light py-2 flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Loading venues…</p>
          ) : !venues || venues.length === 0 ? (
            <p className="text-xs text-text-light py-2">No venues yet — run Discover above.</p>
          ) : (
            <>
              {/* Per-show bulk action */}
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
                <p className="text-xs text-text-light">
                  {venues.length} venues · {venues.filter((v) => v.contactEmail).length} with email
                </p>
                <div className="flex items-center gap-2">
                  {sentMsg && <span className="text-xs text-success-green">{sentMsg}</span>}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={sendToQueued}
                    disabled={sending || queuedEmailable.length === 0}
                  >
                    {sending ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                    Email {queuedEmailable.length} queued
                  </Button>
                </div>
              </div>
              {/* Venue rows */}
              <ul className="divide-y divide-border max-h-80 overflow-y-auto">
                {venues.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${v.contactEmail ? "bg-success-green" : v.phone ? "bg-amber" : "bg-border-medium"}`} />
                      <span className="text-sm text-text truncate">{v.name}</span>
                      {v.leadTier && (
                        <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 font-medium ${TIER_COLORS[v.leadTier]}`}>{v.leadTier}</span>
                      )}
                      <span className="text-[10px] text-text-light shrink-0">
                        {v.distanceMiles != null ? `${v.distanceMiles}mi` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {v.pipelineStage && v.pipelineStage !== "QUEUED" ? (
                        <span className={`text-xs ${STAGE_COLORS[v.pipelineStage] ?? "text-text-light"}`}>
                          {v.pipelineStage.toLowerCase()}
                        </span>
                      ) : v.contactEmail ? (
                        <button
                          type="button"
                          onClick={() => sendOne(v)}
                          disabled={sending}
                          className="flex items-center gap-1 text-xs text-accent-blue hover:underline disabled:opacity-50"
                        >
                          <Send size={11} /> email
                        </button>
                      ) : v.phone ? (
                        <a href={`tel:${v.phone}`} className="flex items-center gap-1 text-xs text-amber hover:underline">
                          <Phone size={11} /> call
                        </a>
                      ) : (
                        <span className="text-[10px] text-text-light">no contact</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
