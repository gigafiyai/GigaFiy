"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, TrendingUp, AlertCircle, Check } from "lucide-react";

type Insight = {
  id: string;
  signal: string;
  stat: string | null;
  action: string;
  impact: "high" | "medium" | "low" | string;
  generatedAt: string;
};

type Funnel = {
  totalVenues: number;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  interested: number;
  deposit: number;
  booked: number;
  cancelled: number;
};

type SubjectVariant = {
  subject: string;
  sent: number;
  opened: number;
  openRate: number;
};

type Survey1Breakdown = Record<string, Record<string, number>>;

type InsightsResponse = {
  insights: Insight[];
  funnel: Funnel;
  subjectVariants: SubjectVariant[];
  survey1Breakdown: Survey1Breakdown;
  latestGeneratedAt: string | null;
};

const QUESTION_LABELS: Record<string, string> = {
  q1: "Main reason for yes",
  q2: "What almost stopped you",
  q3: "How first heard",
  q4: "Process smoothness (1-5)",
};

const IMPACT_STYLES: Record<string, string> = {
  high: "bg-amber-bg text-amber border-amber/30",
  medium: "bg-accent-blue-bg text-accent-blue border-accent-blue/30",
  low: "bg-surface text-text-light border-border",
};

export default function InsightsPage() {
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/insights").then((r) => r.json());
    setData(res);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/insights/generate", { method: "POST" });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      const { source } = await res.json();
      setSource(source);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const funnel = data?.funnel;
  const funnelSteps = funnel
    ? [
        { label: "Venues", value: funnel.totalVenues },
        { label: "Sent", value: funnel.sent },
        { label: "Opened", value: funnel.opened },
        { label: "Clicked", value: funnel.clicked },
        { label: "Interested", value: funnel.interested },
        { label: "Deposit", value: funnel.deposit },
        { label: "Booked", value: funnel.booked },
      ]
    : [];
  const peak = Math.max(...funnelSteps.map((s) => s.value), 1);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Insights"
        description="Claude analyzes pipeline + survey data"
        actions={
          <Button variant="primary" size="sm" onClick={generate} disabled={generating}>
            {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {generating ? "Analyzing…" : "Regenerate insights"}
          </Button>
        }
      />

      <div className="p-6 space-y-6 overflow-y-auto">
        {error && (
          <div className="border border-amber/30 bg-amber-bg rounded-lg p-3 text-sm text-amber flex items-center gap-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Funnel */}
        <section className="border border-border rounded-lg bg-background p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-text">Conversion funnel</h3>
            {data?.latestGeneratedAt && (
              <span className="text-xs text-text-light">
                Last run {new Date(data.latestGeneratedAt).toLocaleString()}
                {source && ` · via ${source}`}
              </span>
            )}
          </div>
          {loading ? (
            <div className="text-sm text-text-light">Loading…</div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {funnelSteps.map((s) => {
                const heightPct = Math.max(8, (s.value / peak) * 100);
                return (
                  <div key={s.label} className="flex flex-col items-center">
                    <p className="text-xs text-text-light">{s.label}</p>
                    <p className="text-lg font-semibold text-text mt-1">{s.value}</p>
                    <div className="w-full mt-2 h-24 bg-surface rounded relative">
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-accent-blue rounded transition-all"
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Signal cards */}
        <section>
          <h3 className="text-sm font-medium text-text mb-3 flex items-center gap-1.5">
            <Sparkles size={14} className="text-accent-blue" />
            Signals
          </h3>
          {loading ? (
            <div className="text-sm text-text-light">Loading…</div>
          ) : data && data.insights.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-6 text-center">
              <p className="text-sm text-text-medium">
                No insights yet. Hit <span className="font-medium">Regenerate</span> once
                you have some pipeline activity.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {data?.insights.map((i) => (
                <div
                  key={i.id}
                  className="border border-border rounded-lg bg-background p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-text">{i.signal}</p>
                    <span
                      className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                        IMPACT_STYLES[i.impact] ?? "text-text-light border-border"
                      }`}
                    >
                      {i.impact} impact
                    </span>
                  </div>
                  {i.stat && (
                    <p className="text-xs text-text-medium flex items-center gap-1.5">
                      <TrendingUp size={11} />
                      {i.stat}
                    </p>
                  )}
                  <p className="text-sm text-text-medium border-t border-border pt-2 mt-2">
                    <span className="text-xs uppercase tracking-wide text-text-light block mb-1">
                      Action
                    </span>
                    {i.action}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Subject line A/B */}
        <section className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text">Subject line performance</h3>
          </div>
          {data && data.subjectVariants.length === 0 ? (
            <div className="px-4 py-6 text-sm text-text-light">
              No subject variants tracked yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface">
                  <th className="text-left px-4 py-2 text-xs font-medium text-text-light">
                    Subject
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-light">
                    Sent
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-light">
                    Opened
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-text-light">
                    Open rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data?.subjectVariants.map((v) => (
                  <tr key={v.subject}>
                    <td className="px-4 py-2 text-text truncate max-w-md">{v.subject}</td>
                    <td className="px-4 py-2 text-right text-text-medium">{v.sent}</td>
                    <td className="px-4 py-2 text-right text-text-medium">{v.opened}</td>
                    <td className="px-4 py-2 text-right font-medium text-text">
                      {v.openRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Survey 1 response breakdown */}
        <section className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <h3 className="text-sm font-medium text-text">Survey 1 response breakdown</h3>
            <Check size={12} className="text-success-green" />
          </div>
          <div className="grid grid-cols-2 gap-0 divide-x divide-border">
            {(["q1", "q2", "q3", "q4"] as const).map((q) => {
              const responses = data?.survey1Breakdown[q] ?? {};
              const entries = Object.entries(responses).sort((a, b) => b[1] - a[1]);
              const total = entries.reduce((s, [, n]) => s + n, 0);
              return (
                <div key={q} className="p-4 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-text-light">
                    {QUESTION_LABELS[q]}
                  </p>
                  {entries.length === 0 ? (
                    <p className="text-xs text-text-light">No responses yet.</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {entries.map(([answer, count]) => {
                        const pct = total === 0 ? 0 : Math.round((count / total) * 100);
                        return (
                          <li key={answer} className="text-xs">
                            <div className="flex justify-between mb-0.5">
                              <span className="text-text-medium truncate pr-2">
                                {answer.replace(/\|\|/g, ", ")}
                              </span>
                              <span className="text-text-light shrink-0">
                                {count} · {pct}%
                              </span>
                            </div>
                            <div className="h-1 rounded-full bg-surface overflow-hidden">
                              <div
                                className="h-full bg-accent-blue"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
