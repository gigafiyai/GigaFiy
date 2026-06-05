"use client";

import { useEffect, useRef, useState } from "react";
import { X, Phone, PhoneCall, Sparkles, Check, Mail, CalendarCheck, DollarSign, Radio } from "lucide-react";

type CallState = {
  active: boolean;
  call: {
    id: string; status: string; transcript: string | null; durationSeconds: number | null;
    callScore: number | null; callTier: string | null; sentiment: string | null;
    summary: string | null; nextAction: string | null;
    agreedToBook: boolean; agreedDate: string | null; agreedTime: string | null; agreedPrice: number | null;
    emailCaptured: string | null; venueBookedThrough: string | null;
  };
  venue: { name: string; city: string; state: string; phone: string | null };
  brief: { firstLine: string; knowledge: { artistFacts: string[]; proofPoints: string[]; venueFacts: string[]; theOffer: string[] } } | null;
};

const TIER_COLORS: Record<string, string> = {
  A: "bg-success-green-bg text-success-green border-success-green/40",
  B: "bg-accent-blue-bg text-accent-blue border-accent-blue/40",
  C: "bg-amber-bg text-amber border-amber/40",
  D: "bg-surface text-text-light border-border",
};

function Waveform({ live }: { live: boolean }) {
  return (
    <div className="flex items-end gap-1 h-10">
      {Array.from({ length: 28 }).map((_, i) => (
        <span
          key={i}
          className={`w-1 rounded-full ${live ? "cockpit-bar bg-success-green" : "bg-border"}`}
          style={{ height: "100%", animationDelay: `${(i % 7) * 0.12}s`, transform: live ? undefined : "scaleY(0.25)" }}
        />
      ))}
    </div>
  );
}

export function CallCockpit({ callId, onClose }: { callId: string; onClose: () => void }) {
  const [state, setState] = useState<CallState | null>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll(first: boolean) {
      const d = await fetch(`/api/calls/${callId}${first ? "?brief=1" : ""}`).then((r) => r.json()).catch(() => null);
      if (stop) return;
      if (d?.ok) {
        setState((prev) => (first || !prev ? d : { ...d, brief: prev.brief }));
        if (d.active) timer = setTimeout(() => poll(false), 2000);
        else timer = setTimeout(() => poll(false), 4000); // a couple more pulls to catch the analysis
      } else {
        timer = setTimeout(() => poll(false), 3000);
      }
    }
    poll(true);
    return () => { stop = true; clearTimeout(timer); };
  }, [callId]);

  // Auto-scroll transcript.
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [state?.call.transcript]);

  const c = state?.call;
  const live = state?.active ?? true;
  const done = !!c?.callScore || !!c?.summary;

  const statusPill = !c ? { label: "Connecting…", cls: "text-text-light" }
    : c.status === "INITIATED" ? { label: "Ringing…", cls: "text-amber" }
    : live ? { label: "Live", cls: "text-success-green" }
    : { label: "Complete", cls: "text-accent-blue" };

  const lines = (c?.transcript ?? "").split("\n").filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-accent-blue-bg flex items-center justify-center">
              <PhoneCall size={16} className="text-accent-blue" />
            </div>
            <div>
              <div className="font-display font-semibold text-text flex items-center gap-2">
                Tulio → {state?.venue.name ?? "…"}
              </div>
              <div className="text-xs text-text-light">{state?.venue.city}{state?.venue.state ? `, ${state.venue.state}` : ""}{state?.venue.phone ? ` · ${state.venue.phone}` : ""}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 text-sm font-medium ${statusPill.cls}`}>
              {live && <Radio size={13} className="animate-pulse" />}{statusPill.label}
            </span>
            <button type="button" onClick={onClose} className="text-text-light hover:text-text"><X size={16} /></button>
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Main — waveform + transcript */}
          <div className="flex-1 flex flex-col min-w-0 border-r border-border">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <Waveform live={live} />
              {live && (
                <a
                  href={state?.venue.phone ? `tel:${state.venue.phone}` : undefined}
                  className="flex items-center gap-1.5 text-xs font-medium text-success-green border border-success-green/40 rounded-full px-3 py-1.5 hover:bg-success-green-bg transition"
                  title="Dial in alongside Tulio"
                >
                  <Phone size={12} /> Join call
                </a>
              )}
            </div>

            <div ref={transcriptRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
              {lines.length === 0 ? (
                <p className="text-sm text-text-light">{live ? "Transcript will stream here as the call connects…" : "No transcript captured."}</p>
              ) : (
                lines.map((line, i) => {
                  const isTulio = line.startsWith("Tulio:");
                  const text = line.replace(/^(Tulio|Venue):\s*/, "");
                  return (
                    <div key={i} className={`fade-in-up flex ${isTulio ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${isTulio ? "bg-surface text-text rounded-tl-sm" : "bg-accent-blue-bg text-text rounded-tr-sm"}`}>
                        <div className="text-[10px] uppercase tracking-wide text-text-light mb-0.5">{isTulio ? "Tulio" : "Venue"}</div>
                        {text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Completion analysis */}
            {done && c && (
              <div className="border-t border-border px-5 py-4 fade-in-up bg-surface">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={14} className="text-accent-blue" />
                  <span className="text-sm font-medium text-text">Call result</span>
                  {c.callTier && <span className={`text-xs font-bold px-2 py-0.5 rounded border ${TIER_COLORS[c.callTier]}`}>{c.callTier} · {c.callScore}/100</span>}
                  {c.sentiment && <span className="text-xs text-text-light capitalize">{c.sentiment}</span>}
                </div>
                {c.summary && <p className="text-sm text-text mb-2">{c.summary}</p>}
                {c.agreedToBook && (
                  <div className="flex flex-wrap gap-3 text-sm text-success-green font-medium">
                    {c.agreedDate && <span className="flex items-center gap-1"><CalendarCheck size={13} /> {c.agreedDate}{c.agreedTime ? ` · ${c.agreedTime}` : ""}</span>}
                    {c.agreedPrice ? <span className="flex items-center gap-1"><DollarSign size={13} /> ${Math.round(c.agreedPrice)}</span> : null}
                    {c.emailCaptured && <span className="flex items-center gap-1"><Mail size={13} /> {c.emailCaptured}</span>}
                    <span className="flex items-center gap-1"><Check size={13} /> Booking link sent</span>
                  </div>
                )}
                {c.venueBookedThrough && <p className="text-xs text-text-light mt-1">Books through: {c.venueBookedThrough}</p>}
                {c.nextAction && !c.agreedToBook && <p className="text-xs text-text-medium mt-1">Next: {c.nextAction}</p>}
              </div>
            )}
          </div>

          {/* Side — what Tulio knows */}
          <aside className="w-72 shrink-0 overflow-y-auto px-4 py-4 space-y-3 bg-background">
            <p className="text-[10px] uppercase tracking-wide text-text-light">Tulio's brief</p>
            {state?.brief ? (
              <>
                <p className="text-sm text-text italic">“{state.brief.firstLine}”</p>
                <Block label="The artist" items={state.brief.knowledge.artistFacts} />
                <Block label="Why this venue" items={state.brief.knowledge.venueFacts} />
                <Block label="The offer" items={state.brief.knowledge.theOffer} />
              </>
            ) : (
              <p className="text-sm text-text-light">Loading brief…</p>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

function Block({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-text-light mb-1">{label}</p>
      <ul className="space-y-1">
        {items.slice(0, 4).map((it, i) => (
          <li key={i} className="text-xs text-text-medium leading-snug">• {it}</li>
        ))}
      </ul>
    </div>
  );
}
