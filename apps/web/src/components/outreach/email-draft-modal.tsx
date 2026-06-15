"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Mail, Loader2, Check, Copy, Send } from "lucide-react";

type Generated = { subject: string; body: string; source?: string };

// Generates an editable email draft the artist sends from their OWN inbox
// (mailto: or copy/paste). We never send it — we just log it once they confirm.
export function EmailDraftModal({
  venueId,
  venueName,
  email,
  onClose,
  onLogged,
}: {
  venueId: string;
  venueName: string;
  email: string | null;
  onClose: () => void;
  onLogged?: () => void;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [logged, setLogged] = useState(false);

  useEffect(() => {
    fetch("/api/outreach/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId }),
    })
      .then((r) => r.json())
      .then((d: Generated) => {
        if (d.subject) setSubject(d.subject);
        if (d.body) setBody(d.body);
      })
      .finally(() => setLoading(false));
  }, [venueId]);

  const mailto = `mailto:${email ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  async function logSent() {
    await fetch("/api/outreach/log-sent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venueId, subject, body }),
    }).catch(() => {});
    setLogged(true);
    onLogged?.();
  }

  async function copy() {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-xl shadow-xl w-full max-w-lg max-h-[88vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-text flex items-center gap-2"><Mail size={15} className="text-accent-blue" /> Email draft</h3>
            <p className="text-xs text-text-light mt-0.5">{venueName}{email ? ` · ${email}` : " · no email on file"}</p>
          </div>
          <button type="button" onClick={onClose} className="text-text-light hover:text-text"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="p-6 text-sm text-text-light flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Writing your draft…</div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-light">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm bg-elevated border border-border rounded-md text-text focus:outline-none focus:border-accent-blue"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wide text-text-light">Body — edit freely before sending</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={14}
                className="mt-1 w-full px-3 py-2 text-sm bg-elevated border border-border rounded-md text-text focus:outline-none focus:border-accent-blue resize-y leading-relaxed"
              />
            </div>
            <p className="text-xs text-text-light">Sends from <span className="text-text-medium">your own email</span> — Gigify just logs it so your pipeline stays current.</p>
          </div>
        )}

        <div className="border-t border-border px-5 py-3 flex items-center gap-2">
          {logged ? (
            <p className="text-sm text-success-green flex items-center gap-1.5"><Check size={14} /> Logged to your pipeline.</p>
          ) : (
            <>
              <Button variant="default" size="sm" onClick={copy}>
                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Copied" : "Copy"}
              </Button>
              {email && (
                <a href={mailto} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md bg-accent-blue text-white hover:opacity-90" onClick={logSent}>
                  <Send size={13} /> Open in email
                </a>
              )}
              <Button variant="primary" size="sm" className="ml-auto" onClick={logSent}>I sent it</Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
