"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Phone, Loader2, Check, MessageSquare, DollarSign } from "lucide-react";

type Brief = {
  firstLine: string;
  voicemail: string;
  knowledge: { artistFacts: string[]; proofPoints: string[]; venueFacts: string[]; theOffer: string[] };
};
type Resp = { venue: { name: string; phone: string | null; city: string; state: string }; pricing: { suggested: number }; brief: Brief };

const OBJECTIONS: { q: string; a: string }[] = [
  { q: "“We're booked up”", a: "Totally understand — how far out are you booking? I can hold a later date when I'm back through." },
  { q: "“What's your draw?”", a: "Strangers consistently respond to the show — happy to send a 60-second clip so you can see it." },
  { q: "“Send me info”", a: "Absolutely — what's the best email? I'll send a short reel + the details right now." },
  { q: "“Need to think about it”", a: "Of course — I'll send everything over. No pressure, and I'm flexible on the date." },
];

function Section({ label, items }: { label: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-text-light mb-1">{label}</p>
      <ul className="space-y-1">{items.map((it, i) => <li key={i} className="text-sm text-text leading-snug">• {it}</li>)}</ul>
    </div>
  );
}

// Talking points for the ARTIST to read while they make the call themselves.
export function CallPrepModal({ venueId, onClose, onLogged }: { venueId: string; onClose: () => void; onLogged?: () => void }) {
  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [logging, setLogging] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/calls/brief?venueId=${venueId}`).then((r) => r.json()).then((d) => { if (d.ok) setData(d); }).finally(() => setLoading(false));
  }, [venueId]);

  async function log(outcome: string) {
    setLogging(true);
    await fetch("/api/calls/log", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId, outcome }),
    }).catch(() => {});
    setLogging(false); setDone(true); onLogged?.();
  }

  const b = data?.brief;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-text flex items-center gap-2"><MessageSquare size={15} className="text-accent-blue" /> Call prep</h3>
            {data && <p className="text-xs text-text-light mt-0.5">{data.venue.name} · {data.venue.city}, {data.venue.state}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-text-light hover:text-text"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-text-light flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Building your talking points…</div>
        ) : !b ? (
          <div className="p-6 text-sm text-text-light">Couldn't load this venue.</div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {data?.venue.phone && (
              <a href={`tel:${data.venue.phone}`} className="flex items-center justify-center gap-2 bg-accent-blue text-white py-2.5 rounded-lg font-medium hover:opacity-90">
                <Phone size={15} /> Call {data.venue.phone}
              </a>
            )}
            <div className="border border-border rounded-lg bg-surface p-3">
              <p className="text-[10px] uppercase tracking-wide text-text-light mb-1">Open with</p>
              <p className="text-sm text-text italic">&ldquo;{b.firstLine.replace(/, an AI booking assistant/, "")}&rdquo;</p>
            </div>
            <Section label="Why this venue" items={b.knowledge.venueFacts} />
            <Section label="Your pitch" items={[...b.knowledge.artistFacts, ...b.knowledge.proofPoints].slice(0, 5)} />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-text-light mb-1 flex items-center gap-1"><DollarSign size={11} /> The ask</p>
              <ul className="space-y-1">{b.knowledge.theOffer.map((it, i) => <li key={i} className="text-sm text-text leading-snug">• {it}</li>)}</ul>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-text-light mb-1">If they say…</p>
              <div className="space-y-2">
                {OBJECTIONS.map((o, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-text-medium font-medium">{o.q}</span>
                    <p className="text-text-light">{o.a}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-border px-5 py-3">
          {done ? (
            <p className="text-sm text-success-green flex items-center gap-1.5"><Check size={14} /> Logged — nice work!</p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-light mr-1">After the call:</span>
              {["Answered", "Voicemail", "No answer"].map((o) => (
                <Button key={o} variant="default" size="sm" disabled={logging} onClick={() => log(o.toUpperCase().replace(" ", "_"))}>{o}</Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
