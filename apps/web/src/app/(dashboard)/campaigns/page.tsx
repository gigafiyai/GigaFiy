"use client";

import { useEffect, useState, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  Gem, Rocket, Bot, Target, Loader2, Check, AlertCircle, Mail, Phone, Zap, Pause, Play,
} from "lucide-react";

type GemData = {
  balance: number;
  gemUsd: number;
  packs: { index: number; usd: number; gems: number; label: string }[];
};
type Channel = "email" | "call";

export default function CampaignsPage() {
  const [gems, setGems] = useState<GemData | null>(null);

  const loadGems = useCallback(async () => {
    const d = await fetch("/api/gems").then((r) => r.json());
    if (d?.ok) setGems(d);
  }, []);

  useEffect(() => { void loadGems(); }, [loadGems]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Campaign Engine"
        description="Buy gems, launch campaigns, set an always-on budget, and run follow-up cadences"
        actions={
          gems && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-text border border-border rounded-full px-3 py-1 bg-background">
              <Gem size={14} className="text-accent-blue" />
              {gems.balance.toLocaleString()} gems
            </div>
          )
        }
      />
      <div className="p-6 space-y-6 overflow-y-auto max-w-4xl mx-auto w-full">
        <GemWallet gems={gems} onChange={loadGems} />
        <CampaignBuilder gems={gems} onSpent={loadGems} />
        <AutopilotControl />
        <PlaybookBoard />
      </div>
    </div>
  );
}

// ── Gem wallet + buy packs ──
function GemWallet({ gems, onChange }: { gems: GemData | null; onChange: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);

  async function buy(index: number) {
    setBusy(index);
    try {
      const r = await fetch("/api/gems/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packIndex: index }),
      });
      const d = await r.json();
      if (d.url) window.location.href = d.url; // Stripe-hosted checkout
      else alert(d.error ?? "Checkout unavailable — is Stripe configured?");
    } finally { setBusy(null); onChange(); }
  }

  return (
    <section className="border border-border rounded-lg bg-background p-4">
      <div className="flex items-center gap-2 mb-1">
        <Gem size={15} className="text-accent-blue" />
        <h2 className="text-sm font-medium text-text">Gem wallet</h2>
      </div>
      <p className="text-xs text-text-light mb-3">
        Gems power every campaign. 1 email = 1 gem · 1 Tulio call = 20 gems.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {gems?.packs.map((p) => (
          <button
            key={p.index}
            type="button"
            onClick={() => buy(p.index)}
            disabled={busy !== null}
            className="border border-border rounded-lg p-3 text-left hover:border-accent-blue hover:bg-surface transition disabled:opacity-50"
          >
            <div className="flex items-center gap-1 text-text font-semibold">
              <Gem size={13} className="text-accent-blue" />
              {p.gems.toLocaleString()}
            </div>
            <div className="text-xs text-text-light mt-0.5">{p.label}</div>
            <div className="text-sm text-text mt-1">
              {busy === p.index ? <Loader2 size={13} className="animate-spin" /> : `$${p.usd}`}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Campaign builder ──
function CampaignBuilder({ gems, onSpent }: { gems: GemData | null; onSpent: () => void }) {
  const [channel, setChannel] = useState<Channel>("email");
  const [topN, setTopN] = useState(50);
  const [ids, setIds] = useState<string[]>([]);
  const [loadingIds, setLoadingIds] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Pull the ranked candidate pool for the chosen channel.
  const loadPool = useCallback(async () => {
    setLoadingIds(true); setResult(null);
    const url = channel === "email" ? "/api/outreach/recommended?limit=200" : "/api/calls/list?limit=200";
    const d = await fetch(url).then((r) => r.json());
    const list = channel === "email" ? d.recommendations : d.calls;
    setIds((list ?? []).map((v: { id: string }) => v.id));
    setLoadingIds(false);
  }, [channel]);

  useEffect(() => { void loadPool(); }, [loadPool]);

  const selected = ids.slice(0, topN);
  const perItem = channel === "call" ? 20 : 1;
  const gemCost = selected.length * perItem;
  const canAfford = (gems?.balance ?? 0) >= gemCost;

  async function run() {
    setRunning(true); setResult(null);
    try {
      const r = await fetch("/api/campaigns/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueIds: selected, channel }),
      });
      const d = await r.json();
      if (!r.ok) { setResult(d.error === "insufficient gems" ? "Not enough gems — top up above." : (d.error ?? "Failed")); return; }
      setResult(`🚀 Launched: ${d.venueCount} ${channel === "call" ? "calls" : "emails"} over ${d.daysSpread} day${d.daysSpread === 1 ? "" : "s"} · ${d.gemCost} gems spent.`);
      onSpent();
    } finally { setRunning(false); }
  }

  return (
    <section className="border border-border rounded-lg bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Rocket size={15} className="text-accent-blue" />
        <h2 className="text-sm font-medium text-text">Launch a campaign</h2>
      </div>

      {/* Channel */}
      <div className="flex gap-2">
        {([["email", Mail, "Email"], ["call", Phone, "Tulio calls"]] as const).map(([c, Icon, label]) => (
          <button
            key={c} type="button" onClick={() => setChannel(c)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-sm transition ${
              channel === c ? "border-accent-blue bg-accent-blue-bg text-accent-blue" : "border-border text-text-medium hover:bg-surface"
            }`}
          >
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {/* Count */}
      <div>
        <div className="flex items-center justify-between text-xs text-text-light mb-1">
          <span>How many of the best-ranked leads?</span>
          <span className="text-text font-medium">{Math.min(topN, ids.length)} of {ids.length} available</span>
        </div>
        <input
          type="range" min={5} max={Math.max(5, ids.length)} step={5} value={topN}
          onChange={(e) => setTopN(Number(e.target.value))}
          className="w-full accent-accent-blue"
        />
      </div>

      {/* Quote + run */}
      <div className="flex items-center justify-between border-t border-border pt-3">
        <div className="text-sm">
          <span className="flex items-center gap-1 text-text font-medium">
            <Gem size={13} className="text-accent-blue" /> {gemCost.toLocaleString()} gems
            <span className="text-text-light font-normal">(~${(gemCost * (gems?.gemUsd ?? 0.02)).toFixed(2)})</span>
          </span>
          {!canAfford && <span className="text-xs text-amber">Short {(gemCost - (gems?.balance ?? 0)).toLocaleString()} gems</span>}
        </div>
        <Button variant="primary" size="sm" onClick={run} disabled={running || loadingIds || selected.length === 0 || !canAfford}>
          {running ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
          Run campaign
        </Button>
      </div>
      <p className="text-[11px] text-text-light">
        Ordered by proximity to your gigs · spread over several days{channel === "email" ? " · rotated across sending domains" : ""} to protect your reputation.
      </p>
      {result && <p className="text-xs text-success-green flex items-center gap-1"><Check size={12} /> {result}</p>}
    </section>
  );
}

// ── Autopilot (Meta-Ads daily budget) ──
type Autopilot = { id: string; channel: string; status: string; dailyGemBudget: number; spentToday: number; callsToday: number; minLeadTier: string | null };

function AutopilotControl() {
  const [autos, setAutos] = useState<Autopilot[]>([]);
  const [budget, setBudget] = useState(200);
  const [channel, setChannel] = useState<Channel>("call");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/autopilot").then((r) => r.json());
    if (d?.ok) setAutos(d.autopilots);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    setBusy(true);
    try {
      await fetch("/api/autopilot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, dailyGemBudget: budget }),
      });
      await load();
    } finally { setBusy(false); }
  }
  async function toggle(a: Autopilot) {
    await fetch("/api/autopilot", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, status: a.status === "active" ? "paused" : "active" }),
    });
    await load();
  }

  return (
    <section className="border border-border rounded-lg bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bot size={15} className="text-purple" />
        <h2 className="text-sm font-medium text-text">Autopilot</h2>
        <span className="text-[10px] uppercase tracking-wide text-text-light">always-on daily budget</span>
      </div>

      {autos.filter((a) => a.status !== "paused" || true).map((a) => (
        <div key={a.id} className="flex items-center justify-between border border-border rounded p-2.5 bg-surface">
          <div className="text-sm">
            <span className="flex items-center gap-1.5 text-text">
              {a.channel === "call" ? <Phone size={12} /> : <Mail size={12} />}
              <strong>{a.dailyGemBudget}</strong> gems/day
              <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${a.status === "active" ? "bg-success-green-bg text-success-green" : "bg-surface text-text-light border border-border"}`}>{a.status}</span>
            </span>
            <span className="text-xs text-text-light">Today: {a.spentToday} gems spent · {a.callsToday} {a.channel === "call" ? "calls" : "emails"}</span>
          </div>
          <Button variant="default" size="sm" onClick={() => toggle(a)}>
            {a.status === "active" ? <><Pause size={12} /> Pause</> : <><Play size={12} /> Resume</>}
          </Button>
        </div>
      ))}

      <div className="border border-dashed border-border rounded p-3 space-y-2">
        <p className="text-xs text-text-light">Spend up to a set number of gems per day calling/emailing your best leads — like a Meta Ads daily budget.</p>
        <div className="flex items-center gap-2">
          {([["call", "Tulio calls"], ["email", "Email"]] as const).map(([c, label]) => (
            <button key={c} type="button" onClick={() => setChannel(c)}
              className={`px-2.5 py-1 rounded border text-xs ${channel === c ? "border-purple bg-purple-bg text-purple" : "border-border text-text-medium"}`}>{label}</button>
          ))}
          <input type="number" min={20} step={20} value={budget} onChange={(e) => setBudget(Number(e.target.value))}
            className="w-24 text-sm border border-border rounded px-2 py-1 bg-elevated" />
          <span className="text-xs text-text-light">gems/day</span>
          <Button variant="primary" size="sm" onClick={create} disabled={busy || budget <= 0}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Bot size={13} />} Start autopilot
          </Button>
        </div>
      </div>
    </section>
  );
}

// ── Playbook board ──
function PlaybookBoard() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [cadence, setCadence] = useState<{ label: string; action: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch("/api/playbook").then((r) => r.json());
    if (d?.ok) { setCounts(d.counts ?? {}); setCadence(d.cadence ?? []); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function enrollTop(n: number) {
    setBusy(true); setMsg(null);
    try {
      const rec = await fetch(`/api/outreach/recommended?limit=${n}`).then((r) => r.json());
      const ids = (rec.recommendations ?? []).map((v: { id: string }) => v.id);
      const d = await fetch("/api/playbook", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueIds: ids }),
      }).then((r) => r.json());
      setMsg(`Enrolled ${d.enrolled} venue${d.enrolled === 1 ? "" : "s"} (${d.skipped} already in a cadence).`);
      await load();
    } finally { setBusy(false); }
  }

  return (
    <section className="border border-border rounded-lg bg-background p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target size={15} className="text-success-green" />
        <h2 className="text-sm font-medium text-text">Follow-up playbook</h2>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-xs text-text-light">
        {cadence.map((s, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="px-2 py-0.5 rounded bg-surface border border-border text-text">{s.label}</span>
            {i < cadence.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-text-medium">
        <span><strong className="text-text">{counts.active ?? 0}</strong> active</span>
        <span><strong className="text-success-green">{counts.converted ?? 0}</strong> converted</span>
        <span><strong className="text-text-light">{counts.completed ?? 0}</strong> completed</span>
        <span><strong className="text-text-light">{counts.stopped ?? 0}</strong> stopped</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={() => enrollTop(50)} disabled={busy}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Target size={13} />} Enroll top 50 leads
        </Button>
        {msg && <span className="text-xs text-success-green flex items-center gap-1"><Check size={12} /> {msg}</span>}
      </div>
      <p className="text-[11px] text-text-light">
        Each enrolled venue is worked through the cadence automatically — and drops out the moment they reply or book.
      </p>
    </section>
  );
}
