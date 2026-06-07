"use client";

import { useEffect, useState } from "react";
import { Loader2, CalendarCheck, FileText, Volume2, Sparkles } from "lucide-react";
import { CallCockpit } from "@/components/voice/call-cockpit";

type Call = {
  id: string; venueName: string; city: string; state: string; status: string;
  summary: string | null; sentiment: string | null; callScore: number | null; callTier: string | null;
  agreedToBook: boolean; agreedDate: string | null; agreedPrice: number | null;
  recordingUrl: string | null; hasTranscript: boolean; durationSeconds: number | null; calledAt: string | null;
};
type Stats = { total: number; booked: number; tierA: number; tierB: number; avgScore: number };

const TIER_COLORS: Record<string, string> = {
  A: "bg-success-green-bg text-success-green border-success-green/30",
  B: "bg-accent-blue-bg text-accent-blue border-accent-blue/30",
  C: "bg-amber-bg text-amber border-amber/30",
  D: "bg-surface text-text-light border-border",
};

// Call history — surfaces the proprietary transcript+outcome dataset. Click any
// call to replay it (transcript + analysis) in the cockpit.
export function CallHistory() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calls").then((r) => r.json()).then((d) => { setCalls(d.calls ?? []); setStats(d.stats ?? null); }).finally(() => setLoading(false));
  }, []);

  return (
    <main className="flex-1 overflow-y-auto">
      {/* Stat strip */}
      {stats && (
        <div className="flex items-stretch border-b border-border bg-surface divide-x divide-border">
          {[
            { label: "Calls", value: stats.total },
            { label: "Booked", value: stats.booked, highlight: true },
            { label: "A-tier", value: stats.tierA },
            { label: "Avg score", value: stats.avgScore },
          ].map((s) => (
            <div key={s.label} className="flex flex-col px-5 py-3 min-w-[90px]">
              <span className="text-xs text-text-light">{s.label}</span>
              <span className={`text-lg font-semibold ${s.highlight ? "text-success-green" : "text-text"}`}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="p-6 text-sm text-text-light flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading call history…</div>
      ) : calls.length === 0 ? (
        <div className="p-6 text-sm text-text-light">No calls yet. Tulio's calls will appear here with transcripts + outcomes.</div>
      ) : (
        <ul className="divide-y divide-border">
          {calls.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpenId(c.id)}
                className="w-full text-left px-5 py-3 hover:bg-surface-hover transition flex items-center gap-3"
              >
                {c.callTier && <span className={`text-xs font-bold px-1.5 py-0.5 rounded border shrink-0 ${TIER_COLORS[c.callTier]}`}>{c.callTier}</span>}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text truncate">{c.venueName}</span>
                    <span className="text-xs text-text-light shrink-0">{c.city}, {c.state}</span>
                    {c.agreedToBook && (
                      <span className="flex items-center gap-1 text-[10px] text-success-green shrink-0"><CalendarCheck size={11} /> booked{c.agreedDate ? ` ${c.agreedDate}` : ""}{c.agreedPrice ? ` · $${Math.round(c.agreedPrice)}` : ""}</span>
                    )}
                  </div>
                  {c.summary && <p className="text-xs text-text-light truncate mt-0.5">{c.summary}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0 text-text-light">
                  {c.hasTranscript && <FileText size={13} />}
                  {c.recordingUrl && <Volume2 size={13} />}
                  {c.callScore != null && <span className="text-xs">{c.callScore}</span>}
                  <span className="text-[10px] uppercase">{c.status.toLowerCase()}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {openId && <CallCockpit callId={openId} onClose={() => setOpenId(null)} />}
    </main>
  );
}
