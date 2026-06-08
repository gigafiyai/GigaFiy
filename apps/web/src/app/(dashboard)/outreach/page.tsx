"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Check, AlertCircle, Loader2, Mail, Rocket } from "lucide-react";
import Link from "next/link";

type OutreachVenue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venueType: string;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  contactEmail: string | null;
  phone: string | null;
  isPhoneOnly: boolean;
  distanceMiles: number | null;
  leadTier: string | null;
  nearestShow: { id: string; venueName: string; city: string; state: string; date: string; dayOfWeek: string } | null;
  latestOutreach: { status: string; subjectLine: string | null; sentAt: string | null; openedAt: string | null } | null;
  pipelineStage: string | null;
};

type GeneratedEmail = { subject: string; body: string; source: "claude" | "template"; fallbackReason?: string };

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "text-text-light", SENT: "text-accent-blue", OPENED: "text-purple",
  CLICKED: "text-purple", REPLIED: "text-success-green", OPTED_OUT: "text-text-light",
};

type Filter = "needs_attention" | "replied" | "opened" | "all";

// Outreach = the response inbox + one-off email composer.
// Bulk sending, follow-up cadences, enrichment, and calls live in their own
// tabs (Campaigns / Voice / Dashboard).
export default function OutreachPage() {
  const [venues, setVenues] = useState<OutreachVenue[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [email, setEmail] = useState<GeneratedEmail | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [statusKind, setStatusKind] = useState<"ok" | "err" | null>(null);
  const [filter, setFilter] = useState<Filter>("needs_attention");

  type ThreadItem = { id: string; direction: "out" | "in"; at: string; subject: string | null; body: string; status?: string; from?: string; classification?: string | null };
  const [thread, setThread] = useState<ThreadItem[]>([]);

  async function refresh() {
    const data: OutreachVenue[] = await fetch("/api/outreach/venues").then((r) => r.json());
    setVenues(data);
    setLoading(false);
  }
  useEffect(() => { void refresh(); }, []);

  // Load the conversation thread for the selected venue.
  useEffect(() => {
    if (!selectedId) { setThread([]); return; }
    fetch(`/api/outreach/thread?venueId=${selectedId}`).then((r) => r.json()).then((d) => setThread(d.ok ? d.items : []));
  }, [selectedId]);

  const selected = useMemo(() => venues.find((v) => v.id === selectedId) ?? null, [venues, selectedId]);

  const counts = useMemo(() => {
    const c = { needs_attention: 0, replied: 0, opened: 0, all: venues.length };
    for (const v of venues) {
      const s = v.latestOutreach?.status ?? "QUEUED";
      if (s === "REPLIED") { c.replied++; c.needs_attention++; }
      else if (s === "OPENED" || s === "CLICKED") { c.opened++; c.needs_attention++; }
    }
    return c;
  }, [venues]);

  const filtered = useMemo(() => {
    return venues.filter((v) => {
      const s = v.latestOutreach?.status ?? "QUEUED";
      switch (filter) {
        case "needs_attention": return s === "REPLIED" || s === "OPENED" || s === "CLICKED";
        case "replied": return s === "REPLIED";
        case "opened": return s === "OPENED" || s === "CLICKED";
        default: return true;
      }
    });
  }, [venues, filter]);

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true); setStatusMsg(null);
    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: selected.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GeneratedEmail = await res.json();
      setEmail(data); setSubject(data.subject); setBody(data.body);
    } catch (e) {
      setStatusKind("err"); setStatusMsg(e instanceof Error ? e.message : "Generation failed");
    } finally { setGenerating(false); }
  }

  async function handleSend() {
    if (!selected || !subject || !body) return;
    setSending(true); setStatusMsg(null);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: selected.id, subject, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setStatusKind("ok");
      setStatusMsg(data.deliveryMode === "logged" ? `Logged (no email provider key — would send to ${data.recipient})` : `Sent to ${data.recipient}`);
      await refresh();
    } catch (e) {
      setStatusKind("err"); setStatusMsg(e instanceof Error ? e.message : "Send failed");
    } finally { setSending(false); }
  }

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: "needs_attention", label: "Needs attention", count: counts.needs_attention },
    { id: "replied", label: "Replied", count: counts.replied },
    { id: "opened", label: "Opened", count: counts.opened },
    { id: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Outreach"
        description="Reply to venues and send one-off emails — bulk campaigns live in the Campaigns tab"
        actions={
          <Link href="/campaigns">
            <Button variant="default" size="sm"><Rocket size={13} /> Bulk in Campaigns</Button>
          </Link>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Inbox */}
        <aside className="w-80 border-r border-border bg-surface overflow-y-auto shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border overflow-x-auto bg-background">
            {FILTERS.map((f) => (
              <button
                key={f.id} type="button" onClick={() => setFilter(f.id)}
                className={`text-xs px-2.5 py-1 rounded-full border shrink-0 transition ${
                  filter === f.id ? "bg-accent-blue text-white border-accent-blue" : "bg-surface border-border text-text-medium hover:bg-surface-hover"
                }`}
              >
                {f.label} {f.count > 0 && <span className="opacity-70">{f.count}</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="px-4 py-6 text-sm text-text-light">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="px-4 py-8 text-sm text-text-light text-center">
              {filter === "needs_attention" ? "Nothing needs attention — no replies or opens yet." : "No venues here."}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((v) => {
                const s = v.latestOutreach?.status ?? "QUEUED";
                const active = v.id === selectedId;
                return (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => { setSelectedId(v.id); setEmail(null); setSubject(""); setBody(""); setStatusMsg(null); }}
                      className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition ${active ? "bg-elevated border-l-2 border-accent-blue" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-text truncate">{v.name}</span>
                        <span className={`text-[10px] uppercase tracking-wide shrink-0 ${STATUS_COLORS[s] ?? "text-text-light"}`}>{s.toLowerCase()}</span>
                      </div>
                      <div className="text-xs text-text-light mt-0.5">{v.city}, {v.state}{v.leadTier ? ` · ${v.leadTier}` : ""}</div>
                      {v.contactEmail && <div className="text-xs text-accent-blue mt-0.5 truncate">{v.contactEmail}</div>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Composer */}
        <main className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="p-6 text-sm text-text-light">Select a venue to reply or compose.</div>
          ) : (
            <div className="max-w-2xl mx-auto p-6 space-y-4">
              <div>
                <div className="text-lg font-semibold text-text font-display">{selected.name}</div>
                <div className="text-sm text-text-medium mt-0.5">
                  {selected.decisionMakerName ?? "Booking contact"}
                  {selected.contactEmail ? ` · ${selected.contactEmail}` : <span className="text-amber"> · no email on file</span>}
                </div>
                {selected.latestOutreach?.status && selected.latestOutreach.status !== "QUEUED" && (
                  <div className="text-xs text-text-light mt-1">
                    Last: {selected.latestOutreach.status.toLowerCase()}
                    {selected.latestOutreach.sentAt ? ` · ${new Date(selected.latestOutreach.sentAt).toLocaleDateString()}` : ""}
                  </div>
                )}
              </div>

              {/* Conversation thread */}
              {thread.length > 0 && (
                <div className="border border-border rounded-lg bg-background p-4 space-y-2.5">
                  <p className="text-xs uppercase tracking-wide text-text-light">Conversation</p>
                  {thread.map((m) => (
                    <div key={m.id} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.direction === "out" ? "bg-accent-blue-bg rounded-tr-sm" : "bg-surface rounded-tl-sm"}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] uppercase tracking-wide text-text-light">
                            {m.direction === "out" ? "Sent" : m.from ?? "Venue"}
                          </span>
                          <span className="text-[10px] text-text-light">{new Date(m.at).toLocaleDateString()}</span>
                          {m.classification && <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-background border border-border text-text-light">{m.classification.toLowerCase().replace("_", " ")}</span>}
                        </div>
                        {m.subject && <p className="text-xs font-medium text-text">{m.subject}</p>}
                        <p className="text-xs text-text-medium whitespace-pre-wrap line-clamp-6">{m.body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-border rounded-lg bg-background overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-medium text-text flex items-center gap-1.5"><Mail size={14} /> {thread.some((m) => m.direction === "in") ? "Reply" : "Compose"}</h3>
                  <Button variant="default" size="sm" onClick={handleGenerate} disabled={generating}>
                    {generating ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {generating ? "Writing…" : email ? "Regenerate" : "Generate with AI"}
                  </Button>
                </div>
                <div className="p-4 space-y-3">
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
                  <textarea
                    value={body} onChange={(e) => setBody(e.target.value)} rows={12}
                    placeholder="Write your message, or hit Generate with AI…"
                    className="w-full text-sm bg-elevated border border-border rounded-md p-3 leading-relaxed resize-y focus:outline-none focus:border-accent-blue text-text"
                  />
                  {email?.source && <p className="text-[11px] text-text-light">Drafted via {email.source === "claude" ? "Claude" : "template"}.</p>}
                  <div className="flex items-center justify-between">
                    {statusMsg ? (
                      <span className={`flex items-center gap-1 text-xs ${statusKind === "ok" ? "text-success-green" : "text-amber"}`}>
                        {statusKind === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}{statusMsg}
                      </span>
                    ) : <span />}
                    <Button variant="primary" size="sm" onClick={handleSend} disabled={sending || !subject || !body || !selected.contactEmail}>
                      {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                      {sending ? "Sending…" : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
