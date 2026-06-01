"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, X, Zap, Check, AlertCircle, Mail, ChevronDown, ChevronUp } from "lucide-react";

type PreviewEmail = {
  venueName: string;
  city: string;
  state: string;
  venueType: string;
  recipient: string | null;
  decisionMakerName: string | null;
  subject: string;
  body: string;
  source: "claude" | "template";
};

type PreviewData = {
  totalQueued: number;
  totalWithEmail: number;
  totalSkipped: number;
  liveMusicVenues: number;
  lowQualityVenues: number;
  previews: PreviewEmail[];
};

type Props = {
  onConfirm: (qualityOnly: boolean) => void;
  onClose: () => void;
};

export function SendPreviewModal({ onConfirm, onClose }: Props) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(0);
  const [confirmed, setConfirmed] = useState(false);
  const [qualityOnly, setQualityOnly] = useState(true);

  useEffect(() => {
    fetch("/api/outreach/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sampleSize: 3 }),
    })
      .then((r) => r.json())
      .then((d: PreviewData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleConfirm() {
    setConfirmed(true);
    onConfirm(qualityOnly);
    onClose();
  }

  const sendCount = data
    ? qualityOnly
      ? data.liveMusicVenues
      : data.totalWithEmail
    : 0;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-text">Launch campaign</h2>
            {data && (
              <div className="mt-1 space-y-1">
                <p className="text-xs text-text-light">
                  <span className="font-medium text-success-green">{data.liveMusicVenues}</span> live music venues ·{" "}
                  <span className="text-amber">{data.lowQualityVenues}</span> restaurants/other ·{" "}
                  <span>{data.totalSkipped} no email</span>
                </p>
                <label className="flex items-center gap-2 text-xs text-text-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={qualityOnly}
                    onChange={(e) => setQualityOnly(e.target.checked)}
                    className="accent-accent-blue"
                  />
                  Only send to live music venues (bars, clubs, arts centers)
                  <span className="text-text-light ml-1">— recommended</span>
                </label>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-text-light hover:text-text">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-text-light text-sm">
              <Loader2 size={16} className="animate-spin" />
              Generating sample emails…
            </div>
          ) : !data ? (
            <div className="py-8 text-center text-sm text-amber flex items-center gap-2 justify-center">
              <AlertCircle size={14} />
              Failed to load preview
            </div>
          ) : data.previews.length === 0 ? (
            <div className="py-8 text-center text-sm text-text-light">
              No venues with emails in the queue. Run enrichment first.
            </div>
          ) : (
            <>
              <p className="text-xs text-text-light bg-surface border border-border rounded p-3">
                These are 3 real emails from the front of your queue — the first venues Gigify will contact.
                {" "}Confirm they look right before launching.
              </p>
              {data.previews.map((preview, i) => (
                <div key={i} className="border border-border rounded-lg bg-background overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded(expanded === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface text-left transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Mail size={13} className="text-text-light shrink-0" />
                        <span className="text-sm font-medium text-text truncate">
                          {preview.venueName} — {preview.city}, {preview.state}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                          preview.source === "claude"
                            ? "bg-success-green-bg text-success-green border-success-green/20"
                            : "bg-surface text-text-light border-border"
                        }`}>
                          {preview.source === "claude" ? "Claude" : "template"}
                        </span>
                      </div>
                      <p className="text-xs text-text-light mt-0.5 pl-5">
                        To: {preview.recipient ?? "no email"} · Subject: {preview.subject}
                      </p>
                    </div>
                    {expanded === i ? (
                      <ChevronUp size={14} className="text-text-light shrink-0" />
                    ) : (
                      <ChevronDown size={14} className="text-text-light shrink-0" />
                    )}
                  </button>
                  {expanded === i && (
                    <div className="px-4 pb-4 border-t border-border bg-surface">
                      <p className="text-xs text-text-light mt-3 mb-1 uppercase tracking-wide">Body</p>
                      <pre className="text-sm text-text whitespace-pre-wrap font-sans leading-relaxed">
                        {preview.body}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-surface">
          <Button variant="default" size="sm" onClick={onClose}>
            <X size={13} />
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleConfirm}
            disabled={loading || confirmed || !data || sendCount === 0}
          >
            {confirmed ? (
              <><Check size={13} /> Launching…</>
            ) : (
              <><Zap size={13} /> Send {sendCount} emails</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
