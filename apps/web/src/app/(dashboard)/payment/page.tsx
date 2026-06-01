"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Clock,
  Check,
  X,
  AlertCircle,
  Loader2,
  TrendingUp,
} from "lucide-react";

type PaymentRow = {
  pipelineId: string;
  venueId: string;
  venueName: string;
  city: string;
  state: string;
  stage: "DEPOSIT" | "BOOKED" | "CANCELLED";
  depositAmount: number | null;
  depositPaidAt: string | null;
  cancellationDeadline: string | null;
  cancelledAt: string | null;
  refundIssuedAt: string | null;
  bookedShowDate: string | null;
  bookedShowFee: number | null;
  msRemainingInWindow: number | null;
  withinWindow: boolean;
};

type PaymentResponse = {
  rows: PaymentRow[];
  totals: {
    depositsCollected: number;
    revenueBooked: number;
    refundsIssued: number;
    gigifyTake: number;
  };
};

function formatCountdown(ms: number | null): string {
  if (ms === null) return "—";
  if (ms <= 0) return "Closed";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m left`;
}

const STAGE_STYLES: Record<PaymentRow["stage"], string> = {
  DEPOSIT: "bg-amber-bg text-amber border-amber/20",
  BOOKED: "bg-success-green-bg text-success-green border-success-green/20",
  CANCELLED: "bg-surface text-text-light border-border",
};

export default function PaymentPage() {
  const [data, setData] = useState<PaymentResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, forceRender] = useState(0);

  async function refresh() {
    const res: PaymentResponse = await fetch("/api/payment").then((r) => r.json());
    setData(res);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // Tick every 30s so the countdown stays current.
    const i = setInterval(() => forceRender((n) => n + 1), 30000);
    return () => clearInterval(i);
  }, []);

  async function cancel(p: PaymentRow) {
    setActionId(p.pipelineId);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${p.pipelineId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const { error: e } = await res.json();
        throw new Error(e ?? `HTTP ${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cancel failed");
    } finally {
      setActionId(null);
    }
  }

  async function confirm(p: PaymentRow) {
    setActionId(p.pipelineId);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${p.pipelineId}/confirm-booking`, { method: "POST" });
      if (!res.ok) {
        const { error: e } = await res.json();
        throw new Error(e ?? `HTTP ${res.status}`);
      }
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirm failed");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Payment" description="Stripe deposits, 24h cancellation, refunds" />

      <div className="p-6 space-y-6 overflow-y-auto">
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Deposits collected",
              value: `$${(data?.totals.depositsCollected ?? 0).toLocaleString()}`,
              icon: CreditCard,
            },
            {
              label: "Revenue booked",
              value: `$${(data?.totals.revenueBooked ?? 0).toLocaleString()}`,
              icon: TrendingUp,
              green: true,
            },
            {
              label: "Refunds issued",
              value: `$${(data?.totals.refundsIssued ?? 0).toLocaleString()}`,
              icon: X,
            },
            {
              label: "Gigify take (12%)",
              value: `$${(data?.totals.gigifyTake ?? 0).toLocaleString()}`,
              icon: TrendingUp,
            },
          ].map(({ label, value, icon: Icon, green }) => (
            <div
              key={label}
              className="border border-border rounded-lg p-4 bg-background"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={13} className="text-text-light" />
                <span className="text-xs text-text-light">{label}</span>
              </div>
              <p
                className={`text-2xl font-semibold ${green ? "text-success-green" : "text-text"}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="border border-border rounded-lg p-5 bg-background">
          <h3 className="text-sm font-medium text-text mb-3">Booking flow</h3>
          <ol className="grid grid-cols-3 gap-3">
            {[
              {
                n: 1,
                t: "Deposit link",
                d: "Stripe Checkout — 50% holds the date",
              },
              {
                n: 2,
                t: "Survey 1 + auto-contract",
                d: "In-app survey first, then PDF + e-signature",
              },
              {
                n: 3,
                t: "Confirmation + 24h window",
                d: "Email with cancel deadline, calendar invite, refund job armed",
              },
            ].map(({ n, t, d }) => (
              <li
                key={n}
                className="rounded border border-border p-3 bg-surface flex flex-col gap-1"
              >
                <span className="text-xs text-text-light">Step {n}</span>
                <span className="text-sm font-medium text-text">{t}</span>
                <span className="text-xs text-text-light">{d}</span>
              </li>
            ))}
          </ol>
        </div>

        <section className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-text">Activity</h3>
            {error && (
              <span className="flex items-center gap-1 text-xs text-amber">
                <AlertCircle size={12} />
                {error}
              </span>
            )}
          </div>
          {loading ? (
            <div className="px-4 py-8 text-sm text-text-light">Loading…</div>
          ) : !data || data.rows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-text-light">
              No deposits yet. Move a pipeline row to DEPOSIT to start tracking — try the "Mark deposit paid" simulator on a venue's row in the Pipeline page.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data.rows.map((p) => (
                <li key={p.pipelineId} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-text truncate">
                          {p.venueName}
                        </p>
                        <span
                          className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${STAGE_STYLES[p.stage]}`}
                        >
                          {p.stage}
                        </span>
                      </div>
                      <div className="text-xs text-text-light mt-0.5">
                        {p.city}, {p.state}
                        {p.depositAmount != null && ` · $${p.depositAmount} deposit`}
                        {p.bookedShowFee != null && ` · $${p.bookedShowFee} total`}
                        {p.bookedShowDate && ` · show ${p.bookedShowDate}`}
                      </div>
                      {p.stage === "DEPOSIT" && (
                        <div className="flex items-center gap-1 mt-1 text-xs">
                          <Clock size={11} className="text-amber" />
                          <span className={p.withinWindow ? "text-amber" : "text-text-light"}>
                            {formatCountdown(p.msRemainingInWindow)}
                          </span>
                        </div>
                      )}
                      {p.cancelledAt && (
                        <div className="text-xs text-text-light mt-1">
                          Cancelled {new Date(p.cancelledAt).toLocaleString()} · refund issued
                        </div>
                      )}
                    </div>
                    {p.stage === "DEPOSIT" && (
                      <div className="flex items-center gap-2 shrink-0">
                        {p.withinWindow ? (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => cancel(p)}
                            disabled={actionId === p.pipelineId}
                          >
                            {actionId === p.pipelineId ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <X size={13} />
                            )}
                            Cancel + refund
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => confirm(p)}
                            disabled={actionId === p.pipelineId}
                          >
                            {actionId === p.pipelineId ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <Check size={13} />
                            )}
                            Confirm booking
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

    </div>
  );
}
