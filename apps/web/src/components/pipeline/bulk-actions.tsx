"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, X, Loader2, Check, AlertCircle } from "lucide-react";

interface BulkActionsProps {
  selectedIds: string[];
  onClear: () => void;
  onSent?: () => void;
}

export function BulkActions({ selectedIds, onClear, onSent }: BulkActionsProps) {
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  if (selectedIds.length === 0) return null;

  async function sendToSelected() {
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/outreach/send-all-queued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineIds: selectedIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatus({
        kind: "ok",
        msg: `Sent ${data.sent} · skipped ${data.skippedNoEmail} (no email) · errors ${data.errors}`,
      });
      onSent?.();
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Send failed" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-accent-blue-bg border-b border-accent-blue/20">
      <span className="text-xs text-accent-blue font-medium">
        {selectedIds.length} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-accent-blue hover:opacity-70 -ml-1"
        aria-label="Clear selection"
      >
        <X size={12} />
      </button>
      <div className="h-3.5 w-px bg-accent-blue/20" />
      <Button variant="primary" size="sm" onClick={sendToSelected} disabled={sending}>
        {sending ? <Loader2 size={13} className="animate-spin" /> : <Mail size={13} />}
        {sending ? "Sending…" : `Send to ${selectedIds.length}`}
      </Button>
      {status && (
        <span
          className={`flex items-center gap-1 text-xs ml-2 ${
            status.kind === "ok" ? "text-success-green" : "text-amber"
          }`}
        >
          {status.kind === "ok" ? <Check size={11} /> : <AlertCircle size={11} />}
          {status.msg}
        </span>
      )}
    </div>
  );
}
