"use client";

import { useEffect, useState } from "react";
import { TrendingUp, CalendarCheck, Wallet, Target, Loader2 } from "lucide-react";

type Income = {
  earnedToDate: number;
  bookedUpcoming: number;
  depositsCollected: number;
  pipelineValue: number;
  projectedTotal: number;
  avgFee: number;
  upcomingCount: number;
  openLeads: number;
};

function money(n: number): string {
  return `$${Math.round(n).toLocaleString()}`;
}

// The "becomes their business" panel — earned, booked, and a probability-
// weighted forecast of the open pipeline.
export function IncomeSummary() {
  const [data, setData] = useState<Income | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/income").then((r) => r.json()).then((d) => { if (d?.ok) setData(d); }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="border border-border rounded-lg px-4 py-4 bg-background text-sm text-text-light flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading income…
      </div>
    );
  }
  if (!data) return null;

  const cards = [
    { label: "Earned to date", value: money(data.earnedToDate), icon: Wallet, color: "text-success-green", sub: "from completed shows" },
    { label: "Booked upcoming", value: money(data.bookedUpcoming), icon: CalendarCheck, color: "text-accent-blue", sub: `${data.upcomingCount} confirmed show${data.upcomingCount === 1 ? "" : "s"}` },
    { label: "Pipeline value", value: money(data.pipelineValue), icon: Target, color: "text-purple", sub: `${data.openLeads} open leads, weighted` },
    { label: "Projected total", value: money(data.projectedTotal), icon: TrendingUp, color: "text-text", sub: "booked + weighted pipeline" },
  ];

  return (
    <div className="border border-border rounded-lg bg-background p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text flex items-center gap-2">
          <TrendingUp size={15} className="text-success-green" /> Income & forecast
        </h3>
        <span className="text-xs text-text-light">
          {money(data.depositsCollected)} deposits collected · avg fee {money(data.avgFee)}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="border border-border rounded-lg p-3 bg-surface">
            <div className="flex items-center gap-1.5">
              <c.icon size={14} className={c.color} />
              <span className="text-[11px] uppercase tracking-wide text-text-light">{c.label}</span>
            </div>
            <div className={`text-xl font-semibold mt-1 ${c.color}`}>{c.value}</div>
            <div className="text-[11px] text-text-light mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
