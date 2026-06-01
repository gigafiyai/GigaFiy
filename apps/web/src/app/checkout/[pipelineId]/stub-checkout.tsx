"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Loader2, CreditCard, AlertCircle } from "lucide-react";

type Props = {
  pipelineId: string;
  artistName: string;
  venueName: string;
  amountCents: number;
};

export function StubCheckout({ pipelineId, artistName, venueName, amountCents }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const amountUsd = (amountCents / 100).toFixed(2);

  async function simulatePayment() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pipeline/${pipelineId}/mark-deposit-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      router.push(`/checkout/${pipelineId}/success?simulated=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-5 py-10">
      <div className="max-w-md w-full bg-background border border-border rounded-lg overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border bg-surface">
          <div className="flex items-center gap-2 text-xs text-text-light uppercase tracking-wide">
            <CreditCard size={13} />
            Stripe Checkout · stub mode
          </div>
        </div>
        <div className="px-5 py-6 space-y-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-light">Pay deposit</p>
            <p className="text-3xl font-semibold text-text mt-1">${amountUsd}</p>
            <p className="text-sm text-text-medium mt-1">
              {artistName} — holds your date at {venueName}.
            </p>
          </div>

          <div className="border border-success-green/20 bg-success-green-bg rounded p-3 flex items-start gap-2">
            <ShieldCheck size={14} className="text-success-green shrink-0 mt-0.5" />
            <p className="text-xs text-text-medium">
              24-hour free cancellation starts the moment this payment confirms. Full
              refund, no questions.
            </p>
          </div>

          <div className="text-xs text-amber border border-amber/20 bg-amber-bg rounded p-3">
            STRIPE_SECRET_KEY not set — this page is a stub. The button below skips the
            real card form and marks the deposit as paid directly in the database.
            Useful for testing the full Survey 1 → confirmation → 24h cancel flow.
          </div>

          {error && (
            <p className="text-xs text-amber flex items-center gap-1">
              <AlertCircle size={12} />
              {error}
            </p>
          )}

          <Button
            variant="primary"
            size="lg"
            onClick={simulatePayment}
            disabled={loading}
            className="w-full"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
            {loading ? "Processing…" : "Simulate successful payment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
