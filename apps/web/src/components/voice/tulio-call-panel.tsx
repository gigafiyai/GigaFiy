"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Phone, PhoneCall, Loader2, Check, AlertCircle, MapPin, Sparkles,
  ChevronDown, ChevronRight, Calendar, DollarSign,
} from "lucide-react";

type CallLead = {
  rank: number;
  id: string;
  name: string;
  city: string;
  state: string;
  venueType: string;
  phone: string | null;
  decisionMakerName: string | null;
  leadScore: number;
  leadTier: "A" | "B" | "C" | "D" | null;
  leadReason: string | null;
  hasEmail: boolean;
  nearestShow: { venueName: string; city: string; state: string; date: string } | null;
  daysUntilShow: number | null;
  lastCall: { status: string; callTier: string | null; calledAt: string | null } | null;
};

type Brief = {
  agentName: string;
  systemPrompt: string;
  firstLine: string;
  voicemail: string;
  knowledge: {
    artistFacts: string[];
    proofPoints: string[];
    venueFacts: string[];
    theOffer: string[];
  };
};

type BriefResponse = {
  venue: { id: string; name: string; phone: string | null; city: string; state: string };
  pricing: { suggested: number; low: number; high: number; basedOn: "history" | "heuristic" };
  brief: Brief;
};

const TIER_COLORS: Record<string, string> = {
  A: "bg-success-green-bg text-success-green border-success-green/30",
  B: "bg-accent-blue-bg text-accent-blue border-accent-blue/30",
  C: "bg-amber-bg text-amber border-amber/30",
  D: "bg-surface text-text-light border-border",
};

function KnowledgeBlock({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-text-light mb-1">{label}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-text leading-snug">• {it}</li>
        ))}
      </ul>
    </div>
  );
}

export function TulioCallPanel() {
  const [leads, setLeads] = useState<CallLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [uncalledOnly, setUncalledOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [dialing, setDialing] = useState(false);
  const [batchN, setBatchN] = useState(10);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  async function refresh() {
    setLoading(true);
    const data = await fetch(`/api/calls/list?limit=50${uncalledOnly ? "&uncalledOnly=true" : ""}`).then((r) => r.json());
    setLeads(data.calls ?? []);
    setLoading(false);
    if (data.calls?.length && !selectedId) setSelectedId(data.calls[0].id);
  }

  useEffect(() => { void refresh(); /* eslint-disable-next-line */ }, [uncalledOnly]);

  const selected = useMemo(() => leads.find((l) => l.id === selectedId) ?? null, [leads, selectedId]);

  useEffect(() => {
    if (!selectedId) { setBrief(null); return; }
    setBriefLoading(true);
    setShowPrompt(false);
    fetch(`/api/calls/brief?venueId=${selectedId}`)
      .then((r) => r.json())
      .then((d) => setBrief(d.ok === false ? null : d))
      .finally(() => setBriefLoading(false));
  }, [selectedId]);

  async function dial(venueIds: string[]) {
    setDialing(true);
    setStatus(null);
    try {
      const res = await fetch("/api/calls/dial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(venueIds.length === 1 ? { venueId: venueIds[0] } : { venueIds }),
      });
      const data = await res.json();
      if (res.status === 503) {
        setStatus({ kind: "err", msg: "Calling not configured — add VAPI_API_KEY + VAPI_PHONE_NUMBER_ID on the server." });
        return;
      }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus({ kind: "ok", msg: `Tulio is calling — ${data.placed} of ${data.attempted} placed.` });
      await refresh();
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Failed to start call" });
    } finally {
      setDialing(false);
    }
  }

  const topIds = leads.slice(0, batchN).map((l) => l.id);

  return (
    <>
      {/* Left: ranked call queue */}
      <aside className="w-80 border-r border-border bg-surface overflow-y-auto shrink-0">
        <div className="px-4 py-3 border-b border-border bg-background">
          <p className="text-xs uppercase tracking-wide text-text-light">Best phone leads</p>
          <p className="text-sm font-medium text-text mt-0.5">
            {leads.length} venue{leads.length === 1 ? "" : "s"} · ranked by tier + timing
          </p>
          <label className="flex items-center gap-1.5 mt-2 text-xs text-text-light cursor-pointer">
            <input type="checkbox" checked={uncalledOnly} onChange={(e) => setUncalledOnly(e.target.checked)} />
            Hide already-called
          </label>
        </div>

        {/* Batch dial */}
        <div className="px-4 py-3 border-b border-border bg-background flex items-center gap-2">
          <select
            value={batchN}
            onChange={(e) => setBatchN(Number(e.target.value))}
            className="text-xs border border-border rounded px-1.5 py-1 bg-white"
          >
            {[5, 10, 25, 50].map((n) => <option key={n} value={n}>Top {n}</option>)}
          </select>
          <Button variant="primary" size="sm" onClick={() => dial(topIds)} disabled={dialing || topIds.length === 0}>
            {dialing ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}
            Call best {Math.min(batchN, leads.length)}
          </Button>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-text-light">Loading…</div>
        ) : leads.length === 0 ? (
          <div className="px-4 py-6 text-sm text-text-light">No phone leads. Enrich venues to capture phone numbers.</div>
        ) : (
          <ul className="divide-y divide-border">
            {leads.map((l) => {
              const active = l.id === selectedId;
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition ${active ? "bg-white border-l-2 border-accent-blue" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-text truncate">
                        <span className="text-text-light mr-1.5">{l.rank}.</span>{l.name}
                      </span>
                      {l.leadTier && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${TIER_COLORS[l.leadTier]}`}>
                          {l.leadTier}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-text-light mt-0.5">
                      {l.city}, {l.state} · {l.venueType.replace(/_/g, " ").toLowerCase()}
                    </div>
                    {l.phone && <div className="text-xs text-accent-blue mt-0.5">{l.phone}</div>}
                    <div className="flex items-center gap-2 mt-1">
                      {l.nearestShow && (
                        <span className="text-[10px] text-text-light flex items-center gap-0.5">
                          <MapPin size={9} />
                          {new Date(l.nearestShow.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          {l.daysUntilShow !== null && l.daysUntilShow >= 0 && ` · ${l.daysUntilShow}d`}
                        </span>
                      )}
                      {l.lastCall && (
                        <span className="text-[10px] text-text-light">called: {l.lastCall.status.toLowerCase()}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Right: brief preview + call */}
      <main className="flex-1 overflow-y-auto">
        {!selected ? (
          <div className="p-6 text-sm text-text-light">Select a lead to see Tulio's brief.</div>
        ) : (
          <div className="max-w-3xl mx-auto p-6 space-y-5">
            {/* Header + call action */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-text">{selected.name}</div>
                <div className="flex items-center gap-3 mt-1">
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} className="flex items-center gap-1.5 text-sm text-accent-blue hover:underline font-medium">
                      <Phone size={14} />{selected.phone}
                    </a>
                  )}
                  {selected.nearestShow && (
                    <span className="flex items-center gap-1 text-xs text-text-light">
                      <MapPin size={11} />
                      near {selected.nearestShow.city} ·{" "}
                      {new Date(selected.nearestShow.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {selected.daysUntilShow !== null && selected.daysUntilShow >= 0 && ` (${selected.daysUntilShow}d out)`}
                    </span>
                  )}
                </div>
              </div>
              <Button variant="primary" size="sm" onClick={() => dial([selected.id])} disabled={dialing}>
                {dialing ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}
                Call now with Tulio
              </Button>
            </div>

            {status && (
              <div className={`flex items-center gap-1.5 text-xs ${status.kind === "ok" ? "text-success-green" : "text-amber"}`}>
                {status.kind === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}{status.msg}
              </div>
            )}

            {briefLoading ? (
              <div className="text-sm text-text-light flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Assembling brief…</div>
            ) : brief ? (
              <>
                {/* Pricing anchor */}
                <div className="flex items-center gap-4 text-sm border border-border rounded-lg bg-background px-4 py-3">
                  <span className="flex items-center gap-1.5 text-text">
                    <DollarSign size={14} className="text-success-green" />
                    Anchor <strong>${brief.pricing.suggested}</strong>
                    <span className="text-text-light">(${brief.pricing.low}–${brief.pricing.high})</span>
                  </span>
                  <span className="text-xs text-text-light">
                    {brief.pricing.basedOn === "history" ? "from Elijah's real fees" : "heuristic"}
                  </span>
                </div>

                {/* What Tulio knows */}
                <div className="border border-border rounded-lg bg-background p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-accent-blue" />
                    <span className="text-sm font-medium text-text">What {brief.brief.agentName} knows</span>
                  </div>
                  <KnowledgeBlock label="The artist" items={brief.brief.knowledge.artistFacts} />
                  <KnowledgeBlock label="Proof points" items={brief.brief.knowledge.proofPoints} />
                  <KnowledgeBlock label="This venue" items={brief.brief.knowledge.venueFacts} />
                  <KnowledgeBlock label="The offer" items={brief.brief.knowledge.theOffer} />
                </div>

                {/* Opener */}
                <div className="border border-border rounded-lg bg-background p-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-wide text-text-light flex items-center gap-1"><Calendar size={11} /> Opener</p>
                  <p className="text-sm text-text italic">“{brief.brief.firstLine}”</p>
                  <p className="text-[10px] uppercase tracking-wide text-text-light mt-2">Voicemail</p>
                  <p className="text-sm text-text-medium">{brief.brief.voicemail}</p>
                </div>

                {/* Full system prompt (collapsible) */}
                <div className="border border-border rounded-lg bg-background overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowPrompt((s) => !s)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm text-text hover:bg-surface"
                  >
                    <span className="font-medium">Full call brief (system prompt)</span>
                    {showPrompt ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </button>
                  {showPrompt && (
                    <pre className="px-4 py-3 text-xs text-text-medium whitespace-pre-wrap border-t border-border font-mono leading-relaxed max-h-96 overflow-y-auto">
                      {brief.brief.systemPrompt}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <div className="text-sm text-text-light">Couldn't load the brief for this venue.</div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
