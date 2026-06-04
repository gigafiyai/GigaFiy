"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Check, AlertCircle, ShieldCheck, Info } from "lucide-react";

type Budget = { plan: "free" | "pro" | "premium"; cap: number; sentToday: number; remaining: number };
type Recommended = { budget: Budget; count: number };

const PLAN_LABEL: Record<string, string> = { free: "Free", pro: "Pro", premium: "Premium" };

// Daily-send budget meter + cap-respecting "send next N" action.
// Surfaces WHY sends stop at the cap (cold-email reputation protection) so a
// drained queue never looks broken.
export function SendBudget() {
  const [data, setData] = useState<Recommended | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const refresh = useCallback(async () => {
    const d = await fetch("/api/outreach/recommended?limit=50").then((r) => r.json());
    if (d?.ok) setData({ budget: d.budget, count: d.count });
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function sendToday() {
    if (!data || data.budget.remaining <= 0) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/outreach/send-all-queued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: data.budget.remaining, qualityOnly: true }),
      });
      const r = await res.json();
      if (!res.ok) throw new Error(r.error ?? `HTTP ${res.status}`);
      const sent = r.sent ?? 0;
      setStatus({
        kind: "ok",
        msg:
          `Sent ${sent} email${sent === 1 ? "" : "s"}.` +
          (r.cappedByDailyLimit ? " Daily cap reached — more tomorrow." : "") +
          (r.budget ? ` ${r.budget.sentToday}/${r.budget.cap} today.` : ""),
      });
      await refresh();
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Send failed" });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="border border-border rounded-lg px-4 py-4 bg-background text-sm text-text-light flex items-center gap-2">
        <Loader2 size={14} className="animate-spin" /> Loading send budget…
      </div>
    );
  }
  if (!data) return null;

  const { budget, count } = data;
  const pct = budget.cap > 0 ? Math.min(100, Math.round((budget.sentToday / budget.cap) * 100)) : 0;
  const tapped = budget.remaining <= 0;

  return (
    <div className="border border-border rounded-lg px-4 py-4 bg-background space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={15} className="text-success-green" />
            <h3 className="text-sm font-medium text-text">Daily outreach</h3>
            <span className="text-[10px] uppercase tracking-wide text-text-light border border-border rounded px-1.5 py-0.5">
              {PLAN_LABEL[budget.plan]} · {budget.cap}/day
            </span>
          </div>
          <p className="text-xs text-text-light mt-1">
            {budget.sentToday} of {budget.cap} sent today · {count} reachable lead{count === 1 ? "" : "s"} ranked & ready
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={sendToday} disabled={sending || tapped || count === 0}>
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {tapped ? "Cap reached" : `Send next ${Math.min(budget.remaining, count)}`}
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${tapped ? "bg-success-green" : "bg-accent-blue"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {status ? (
        <p className={`flex items-center gap-1.5 text-xs ${status.kind === "ok" ? "text-success-green" : "text-amber"}`}>
          {status.kind === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}
          {status.msg}
        </p>
      ) : (
        <p className="flex items-start gap-1.5 text-[11px] text-text-light">
          <Info size={12} className="mt-0.5 shrink-0" />
          Sends are paced to protect your sender reputation — small daily volume keeps cold email out of spam.
        </p>
      )}
    </div>
  );
}
