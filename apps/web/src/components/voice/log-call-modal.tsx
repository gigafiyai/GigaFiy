"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Phone, Voicemail, PhoneOff, AlertCircle, Loader2, Check, Sparkles, Mail } from "lucide-react";

type Outcome = "ANSWERED" | "VOICEMAIL" | "NO_ANSWER" | "FAILED";

type Analysis = {
  summary: string;
  sentiment: "positive" | "neutral" | "negative";
  callScore: number;
  callTier: "A" | "B" | "C" | "D";
  nextAction: string;
  emailCaptured: string | null;
  contactNameCaptured: string | null;
};

type Props = {
  venueId: string;
  venueName: string;
  onClose: () => void;
  onLogged: () => void;
};

const OUTCOMES: { value: Outcome; label: string; icon: typeof Phone }[] = [
  { value: "ANSWERED", label: "Answered", icon: Phone },
  { value: "VOICEMAIL", label: "Voicemail", icon: Voicemail },
  { value: "NO_ANSWER", label: "No answer", icon: PhoneOff },
  { value: "FAILED", label: "Failed", icon: AlertCircle },
];

const TIER_COLORS: Record<string, string> = {
  A: "bg-success-green-bg text-success-green border-success-green/30",
  B: "bg-accent-blue-bg text-accent-blue border-accent-blue/30",
  C: "bg-amber-bg text-amber border-amber/30",
  D: "bg-surface text-text-light border-border",
};

export function LogCallModal({ venueId, venueName, onClose, onLogged }: Props) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [transcript, setTranscript] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!outcome) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/calls/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId, outcome, transcript }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to log call");
      setAnalysis(data.analysis);
      onLogged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text">Log call</h2>
            <p className="text-xs text-text-light mt-0.5">{venueName}</p>
          </div>
          <button type="button" onClick={onClose} className="text-text-light hover:text-text">
            <X size={15} />
          </button>
        </div>

        {/* If analyzed, show the result */}
        {analysis ? (
          <div className="px-5 py-4 space-y-3 overflow-y-auto">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-accent-blue" />
              <span className="text-sm font-medium text-text">AI call analysis</span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-lg font-bold px-2.5 py-1 rounded border ${TIER_COLORS[analysis.callTier]}`}>
                {analysis.callTier}
              </span>
              <div>
                <p className="text-sm font-medium text-text">{analysis.callScore}/100 booking likelihood</p>
                <p className="text-xs text-text-light capitalize">{analysis.sentiment} sentiment</p>
              </div>
            </div>
            <div className="border border-border rounded p-3 bg-surface space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-text-light">Summary</p>
                <p className="text-sm text-text">{analysis.summary}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-text-light">Next action</p>
                <p className="text-sm text-text">{analysis.nextAction}</p>
              </div>
              {(analysis.emailCaptured || analysis.contactNameCaptured) && (
                <div className="flex items-center gap-1.5 text-sm text-success-green border-t border-border pt-2">
                  <Mail size={12} />
                  Captured: {analysis.contactNameCaptured ?? ""}{" "}
                  {analysis.emailCaptured ?? ""}
                </div>
              )}
            </div>
            <Button variant="primary" size="sm" onClick={onClose} className="w-full">
              <Check size={13} />
              Done
            </Button>
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4 overflow-y-auto">
            {/* Outcome */}
            <div>
              <p className="text-xs uppercase tracking-wide text-text-light mb-2">How did it go?</p>
              <div className="grid grid-cols-2 gap-2">
                {OUTCOMES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOutcome(value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded border text-sm transition-colors ${
                      outcome === value
                        ? "bg-accent-blue-bg border-accent-blue text-accent-blue"
                        : "border-border text-text-medium hover:bg-surface"
                    }`}
                  >
                    <Icon size={14} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes / transcript */}
            <div>
              <p className="text-xs uppercase tracking-wide text-text-light mb-1">
                What happened? <span className="text-text-light normal-case">(notes or transcript)</span>
              </p>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={5}
                placeholder="e.g. Spoke to Sarah the owner. She's interested, asked about my draw. Said to email her at sarah@venue.com with the booking link and some dates."
                className="w-full text-sm bg-white border border-border rounded-md p-3 leading-relaxed resize-y focus:outline-none focus:border-accent-blue"
              />
              <p className="text-[10px] text-text-light mt-1">
                The more detail you give, the better Gigify ranks the call and captures the contact.
              </p>
            </div>

            {error && (
              <p className="text-xs text-amber flex items-center gap-1">
                <AlertCircle size={12} /> {error}
              </p>
            )}

            <Button
              variant="primary"
              size="sm"
              onClick={submit}
              disabled={!outcome || submitting}
              className="w-full"
            >
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
              {submitting ? "Analyzing call…" : "Log + analyze call"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
