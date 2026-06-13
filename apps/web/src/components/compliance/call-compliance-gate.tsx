"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShieldAlert, X } from "lucide-react";

const ATTESTATION =
  "I confirm I have a lawful basis to place these calls — e.g. the venue's published booking line, a contact who has replied or expressed interest, or prior consent. I understand AI-voice calls are subject to the TCPA and that I am responsible for compliance.";

// Shown before any AI-calling action. The artist must attest a lawful basis
// each time (consent-gated posture). On confirm, the caller passes ack:true.
export function CallComplianceGate({
  label,
  onConfirm,
  onCancel,
}: {
  label: string; // e.g. "Call 25 venues with Tulio"
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-text flex items-center gap-2">
            <ShieldAlert size={16} className="text-amber" /> Before you call
          </h3>
          <button type="button" onClick={onCancel} className="text-text-light hover:text-text"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-text-medium">
            AI-voice calls are regulated under the TCPA — the FCC treats AI voices as &ldquo;artificial&rdquo; voices that
            generally require the called party&rsquo;s consent. Calling a venue&rsquo;s published booking line or a contact who
            has already replied is the safest basis.
          </p>
          <label className="flex items-start gap-2 text-sm text-text cursor-pointer border border-border rounded-lg p-3 bg-surface">
            <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
            <span>{ATTESTATION}</span>
          </label>
          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="default" size="sm" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" size="sm" disabled={!checked} onClick={onConfirm}>
              {label}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
