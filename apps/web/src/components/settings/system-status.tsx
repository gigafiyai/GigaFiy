"use client";

import { useEffect, useState } from "react";
import { Check, X, Loader2, Activity } from "lucide-react";

type Health = {
  integrations: {
    database: { configured: boolean };
    ai: { configured: boolean };
    email: { configured: boolean; provider: string; from: string | null; failover: boolean };
    calls: { configured: boolean; webhook: boolean };
    payments: { configured: boolean; mode: string | null; webhook: boolean };
    discovery: { googlePlaces: boolean; setlistFm: boolean; foursquare: boolean };
    enrichment: { hunter: boolean; apollo: boolean; bookingAgent: boolean };
    cron: { configured: boolean };
  };
};

function Dot({ on }: { on: boolean }) {
  return on ? (
    <span className="flex items-center gap-1 text-xs text-success-green"><Check size={12} /> connected</span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-text-light"><X size={12} /> not set</span>
  );
}

// System status — live integration readiness so go-live config is self-evident.
export function SystemStatus() {
  const [h, setH] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const d = await fetch("/api/health").then((r) => r.json()).catch(() => null);
    if (d?.ok) setH(d);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);

  const i = h?.integrations;
  const rows: { label: string; on: boolean; detail?: string }[] = i
    ? [
        { label: "Database", on: i.database.configured },
        { label: "AI (Claude)", on: i.ai.configured },
        { label: "Email", on: i.email.configured, detail: i.email.configured ? `${i.email.provider}${i.email.from ? ` · ${i.email.from}` : ""}${i.email.failover ? " · failover on" : ""}` : "add EMAIL_FROM + Resend domain" },
        { label: "Calls (Vapi)", on: i.calls.configured, detail: i.calls.configured ? (i.calls.webhook ? "webhook set" : "⚠ no webhook URL") : "add VAPI_API_KEY + PHONE_NUMBER_ID" },
        { label: "Payments (Stripe)", on: i.payments.configured, detail: i.payments.configured ? `${i.payments.mode} mode${i.payments.webhook ? " · webhook set" : " · ⚠ no webhook"}` : "add STRIPE_SECRET_KEY" },
        { label: "Discovery (Google Places)", on: i.discovery.googlePlaces },
        { label: "Enrichment (Hunter/Apollo)", on: i.enrichment.hunter || i.enrichment.apollo, detail: [i.enrichment.hunter && "Hunter", i.enrichment.apollo && "Apollo", i.enrichment.bookingAgent && "Booking-Agent"].filter(Boolean).join(", ") || undefined },
        { label: "Automation (cron)", on: i.cron.configured, detail: i.cron.configured ? "hourly engine armed" : "manual via Run engine now" },
      ]
    : [];

  return (
    <section className="border border-border rounded-lg bg-background overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-text flex items-center gap-1.5"><Activity size={14} className="text-accent-blue" /> System status</h3>
        <button type="button" onClick={() => { setLoading(true); void load(); }} className="text-xs text-text-light hover:text-text">refresh</button>
      </div>
      {loading ? (
        <div className="px-4 py-4 text-sm text-text-light flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Checking…</div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <span className="text-sm text-text">{r.label}</span>
                {r.detail && <p className="text-xs text-text-light mt-0.5 truncate">{r.detail}</p>}
              </div>
              <Dot on={r.on} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
