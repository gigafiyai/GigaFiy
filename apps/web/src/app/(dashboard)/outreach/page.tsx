"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, Check, AlertCircle, Zap, Loader2, UserSearch, RefreshCw, Phone, PhoneCall, Bot } from "lucide-react";
import { SendPreviewModal } from "@/components/outreach/send-preview-modal";

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
  nearestShow: {
    id: string;
    venueName: string;
    city: string;
    state: string;
    date: string;
    dayOfWeek: string;
  } | null;
  latestOutreach: {
    status: string;
    subjectLine: string | null;
    sentAt: string | null;
    openedAt: string | null;
  } | null;
  pipelineStage: string | null;
};

type GeneratedEmail = {
  subject: string;
  body: string;
  source: "claude" | "template";
  fallbackReason?: string;
};

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "text-text-light",
  SENT: "text-accent-blue",
  OPENED: "text-purple",
  CLICKED: "text-purple",
  REPLIED: "text-success-green",
  OPTED_OUT: "text-text-light",
};

type SidebarFilter = "all" | "has_email" | "phone_only" | "queued" | "sent";

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
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [enrichSummary, setEnrichSummary] = useState<string | null>(null);
  const [filter, setFilter] = useState<SidebarFilter>("all");
  const [draining, setDraining] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [followUpCount, setFollowUpCount] = useState<number | null>(null);
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [followUpSummary, setFollowUpSummary] = useState<string | null>(null);

  // Call panel state
  const [voicemailScript, setVoicemailScript] = useState<string>("");
  const [generatingScript, setGeneratingScript] = useState(false);
  const [callStatus, setCallStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);
  const [captureEmail, setCaptureEmail] = useState("");
  const [captureName, setCaptureName] = useState("");
  const [showCapture, setShowCapture] = useState(false);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    fetch("/api/outreach/venues")
      .then((r) => r.json())
      .then((data: OutreachVenue[]) => {
        setVenues(data);
        setLoading(false);
        if (data.length > 0) setSelectedId(data[0].id);
      });
  }, []);

  const selected = useMemo(
    () => venues.find((v) => v.id === selectedId) ?? null,
    [venues, selectedId]
  );

  const counts = useMemo(() => {
    const c = { all: 0, has_email: 0, phone_only: 0, queued: 0, sent: 0 };
    for (const v of venues) {
      c.all++;
      if (v.contactEmail) c.has_email++;
      if (v.isPhoneOnly) c.phone_only++;
      const s = v.latestOutreach?.status ?? "QUEUED";
      if (s === "QUEUED") c.queued++;
      else if (s === "SENT" || s === "OPENED" || s === "CLICKED" || s === "REPLIED") c.sent++;
    }
    return c;
  }, [venues]);

  const filteredVenues = useMemo(() => {
    return venues.filter((v) => {
      const s = v.latestOutreach?.status ?? "QUEUED";
      switch (filter) {
        case "has_email":
          return !!v.contactEmail;
        case "phone_only":
          return v.isPhoneOnly;
        case "queued":
          return s === "QUEUED";
        case "sent":
          return s === "SENT" || s === "OPENED" || s === "CLICKED" || s === "REPLIED";
        default:
          return true;
      }
    });
  }, [venues, filter]);

  // Group venues chronologically by their nearest confirmed show. Preserves the
  // sort order from the API (date asc → has-email first → distance asc within group).
  const venueGroups = useMemo(() => {
    const groups: {
      showId: string;
      showLabel: string;
      showDate: string;
      venues: OutreachVenue[];
      hasEmailCount: number;
      sentCount: number;
    }[] = [];
    const byId = new Map<string, (typeof groups)[number]>();
    for (const v of filteredVenues) {
      const key = v.nearestShow?.id ?? "__none__";
      let g = byId.get(key);
      if (!g) {
        const ns = v.nearestShow;
        const label = ns
          ? `${ns.dayOfWeek.slice(0, 3)} · ${new Date(ns.date + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} — ${ns.venueName} (${ns.city}, ${ns.state})`
          : "No anchor show";
        g = {
          showId: key,
          showLabel: label,
          showDate: ns?.date ?? "9999-12-31",
          venues: [],
          hasEmailCount: 0,
          sentCount: 0,
        };
        groups.push(g);
        byId.set(key, g);
      }
      g.venues.push(v);
      if (v.contactEmail) g.hasEmailCount++;
      const s = v.latestOutreach?.status ?? "QUEUED";
      if (s !== "QUEUED") g.sentCount++;
    }
    return groups;
  }, [filteredVenues]);

  async function handleGenerate() {
    if (!selected) return;
    setGenerating(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: selected.id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: GeneratedEmail = await res.json();
      setEmail(data);
      setSubject(data.subject);
      setBody(data.body);
    } catch (e) {
      setStatusKind("err");
      setStatusMsg(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleEnrichAll() {
    setEnriching(true);
    setBulkSummary(null);
    setEnrichSummary("starting…");
    const totals = { enriched: 0, noMatch: 0, skippedNoWebsite: 0 };
    let lastRemaining = Infinity;
    try {
      while (true) {
        const res = await fetch("/api/venues/enrich-all?tier=free&limit=25", {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) {
          setEnrichSummary(data.error ?? `HTTP ${res.status}`);
          break;
        }
        totals.enriched += data.enriched ?? 0;
        totals.noMatch += data.noMatch ?? 0;
        totals.skippedNoWebsite += data.skippedNoWebsite ?? 0;
        const remaining = data.eligibleRemaining ?? 0;
        setEnrichSummary(
          `${totals.enriched} enriched · ${totals.noMatch} no match${
            totals.skippedNoWebsite ? ` · ${totals.skippedNoWebsite} no website` : ""
          } · ${remaining} left`
        );
        // Refresh the sidebar so the user sees emails landing in real time.
        try {
          const refreshed = await fetch("/api/outreach/venues").then((r) => r.json());
          setVenues(refreshed);
        } catch {}
        if (remaining === 0) break;
        if (data.attempted === 0 || remaining >= lastRemaining) break;
        lastRemaining = remaining;
      }
    } catch (e) {
      setEnrichSummary(e instanceof Error ? e.message : "Enrich failed");
    } finally {
      setEnriching(false);
    }
  }

  async function handleBulkSend() {
    setBulkSending(true);
    setBulkSummary(null);
    try {
      const res = await fetch("/api/outreach/send-all-queued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBulkSummary(
        `Sent ${data.sent} · skipped ${data.skippedNoEmail} (no email) · errors ${data.errors} · ${data.remainingQueued} queued remaining`
      );
      const refreshed = await fetch("/api/outreach/venues").then((r) => r.json());
      setVenues(refreshed);
    } catch (e) {
      setBulkSummary(e instanceof Error ? e.message : "Bulk send failed");
    } finally {
      setBulkSending(false);
    }
  }

  // Load follow-up count on mount
  useEffect(() => {
    fetch("/api/outreach/follow-up")
      .then((r) => r.json())
      .then((d) => setFollowUpCount(d.total ?? 0))
      .catch(() => {});
  }, [venues]);

  async function handleFollowUp() {
    setSendingFollowUp(true);
    setFollowUpSummary(null);
    try {
      const res = await fetch("/api/outreach/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50, tier: "both" }),
      });
      const data = await res.json();
      setFollowUpSummary(`Follow-up: ${data.sent} sent · ${data.errors} errors · ${data.remaining} remaining`);
      const refreshed = await fetch("/api/outreach/venues").then((r) => r.json());
      setVenues(refreshed);
    } catch (e) {
      setFollowUpSummary(e instanceof Error ? e.message : "Failed");
    } finally {
      setSendingFollowUp(false);
    }
  }

  async function handleDrain() {
    setShowPreview(true);
  }

  async function executeDrain(qualityOnly = true) {
    setDraining(true);
    setBulkSummary(null);
    const totals = { sent: 0, skipped: 0, errors: 0 };
    try {
      while (true) {
        const res = await fetch("/api/outreach/send-all-queued", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ limit: 50, qualityOnly }),
        });
        const data = await res.json();
        if (!res.ok) {
          setBulkSummary(data.error ?? `HTTP ${res.status}`);
          break;
        }
        totals.sent += data.sent ?? 0;
        totals.skipped += data.skippedNoEmail ?? 0;
        totals.errors += data.errors ?? 0;
        setBulkSummary(
          `Draining… ${totals.sent} sent · ${totals.skipped} no-email · ${totals.errors} errors · ${data.remainingQueued} left`
        );
        // Refresh sidebar to show stages updating.
        try {
          const refreshed = await fetch("/api/outreach/venues").then((r) => r.json());
          setVenues(refreshed);
        } catch {}
        if (data.sent === 0 || data.remainingQueued === 0) {
          setBulkSummary(
            `Drained — ${totals.sent} sent · ${totals.skipped} skipped no-email · ${totals.errors} errors`
          );
          break;
        }
      }
    } catch (e) {
      setBulkSummary(e instanceof Error ? e.message : "Drain failed");
    } finally {
      setDraining(false);
    }
  }

  async function handleSend() {
    if (!selected || !subject || !body) return;
    setSending(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: selected.id, subject, body }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatusKind("ok");
      setStatusMsg(
        data.deliveryMode === "sendgrid"
          ? `Sent to ${data.recipient}`
          : `Logged (no SendGrid key — would send to ${data.recipient ?? "unknown"})`
      );
      const refreshed = await fetch("/api/outreach/venues").then((r) => r.json());
      setVenues(refreshed);
    } catch (e) {
      setStatusKind("err");
      setStatusMsg(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Outreach"
        description="AI email engine — Claude + SendGrid"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(enrichSummary || bulkSummary || followUpSummary) && (
              <span
                className="text-xs text-text-light max-w-xs truncate"
                title={followUpSummary ?? enrichSummary ?? bulkSummary ?? ""}
              >
                {followUpSummary ?? enrichSummary ?? bulkSummary}
              </span>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={handleEnrichAll}
              disabled={enriching || bulkSending}
              title="Scrape every venue's website for booking@/events@ emails (free)"
            >
              {enriching ? <Loader2 size={13} className="animate-spin" /> : <UserSearch size={13} />}
              {enriching ? "Enriching…" : "Enrich all from websites"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleBulkSend}
              disabled={bulkSending || enriching || draining}
              title="Generate + send emails for the next 25 QUEUED venues with a contact email"
            >
              {bulkSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {bulkSending ? "Sending…" : "Send next 25"}
            </Button>
            {followUpCount !== null && followUpCount > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={handleFollowUp}
                disabled={sendingFollowUp || draining}
                title="Send follow-ups: opened-no-reply (72h) + sent-no-open (48h)"
              >
                {sendingFollowUp ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {sendingFollowUp ? "Sending…" : `Follow up (${followUpCount})`}
              </Button>
            )}
            {counts.phone_only > 0 && (
              <Button
                variant="default"
                size="sm"
                className="border-purple/30 text-purple hover:bg-purple-bg"
                title={`Nova calls ${counts.phone_only} phone-only venues · ~$${(counts.phone_only * 0.35).toFixed(2)} · Pro plan`}
                disabled
              >
                <Bot size={13} />
                Nova: {counts.phone_only} calls (~${(counts.phone_only * 0.35).toFixed(0)})
              </Button>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleDrain}
              disabled={draining || bulkSending || enriching || counts.queued === 0}
              title="Preview emails then launch campaign"
            >
              {draining ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {draining ? "Launching…" : `Launch (${counts.queued})`}
            </Button>
          </div>
        }
      />
      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 border-r border-border bg-surface overflow-y-auto shrink-0">
          {loading ? (
            <div className="px-4 py-6 text-sm text-text-light">Loading…</div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-border bg-background flex flex-wrap gap-1">
                {(
                  [
                    { value: "all", label: "All" },
                    { value: "has_email", label: "Has email" },
                    { value: "phone_only", label: "📞 Phone only" },
                    { value: "queued", label: "Queued" },
                    { value: "sent", label: "Sent" },
                  ] as { value: SidebarFilter; label: string }[]
                ).map(({ value, label }) => {
                  const active = filter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFilter(value)}
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                        active
                          ? "bg-accent-blue text-white border-accent-blue"
                          : "bg-surface border-border text-text-medium hover:bg-surface-hover"
                      }`}
                    >
                      {label} <span className="opacity-70">{counts[value]}</span>
                    </button>
                  );
                })}
              </div>
              <div>
                {venueGroups.map((group) => (
                  <div key={group.showId}>
                    {/* Show header — sticky to top of scroll for context */}
                    <div className="sticky top-0 z-10 px-3 py-2 border-y border-border bg-surface">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-text">
                        {group.showLabel}
                      </p>
                      <p className="text-[10px] text-text-light mt-0.5">
                        {group.venues.length} venue{group.venues.length === 1 ? "" : "s"} ·{" "}
                        {group.hasEmailCount} with email · {group.sentCount} contacted
                      </p>
                    </div>
                    <ul className="divide-y divide-border">
                      {group.venues.map((v) => {
                        const status = v.latestOutreach?.status ?? "QUEUED";
                        const active = v.id === selectedId;
                        const hasEmail = !!v.contactEmail;
                        return (
                          <li key={v.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedId(v.id);
                                setEmail(null);
                                setSubject("");
                                setBody("");
                                setStatusMsg(null);
                              }}
                              className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition ${
                                active ? "bg-white border-l-2 border-accent-blue" : ""
                              }`}
                            >
                              <div className="flex items-baseline justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {v.isPhoneOnly ? (
                                    <Phone size={10} className="text-accent-blue shrink-0" />
                                  ) : (
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                        hasEmail ? "bg-success-green" : "bg-border-medium"
                                      }`}
                                      title={hasEmail ? "Email on file" : "No email"}
                                    />
                                  )}
                                  <span className="text-sm font-medium text-text truncate">{v.name}</span>
                                  {(v as any).leadTier && (
                                    <span className={`text-[9px] px-1 py-0.5 rounded shrink-0 font-medium ${
                                      (v as any).leadTier === "A" ? "bg-success-green-bg text-success-green" :
                                      (v as any).leadTier === "B" ? "bg-accent-blue-bg text-accent-blue" :
                                      (v as any).leadTier === "C" ? "bg-amber-bg text-amber" :
                                      "bg-surface text-text-light border border-border"
                                    }`}>
                                      {(v as any).leadTier}
                                    </span>
                                  )}
                                </div>
                                <span
                                  className={`text-[10px] uppercase tracking-wide shrink-0 ${
                                    STATUS_COLORS[status] ?? "text-text-light"
                                  }`}
                                >
                                  {status}
                                </span>
                              </div>
                              <div className="text-xs text-text-light mt-0.5 pl-3">
                                {v.city}, {v.state} · {v.venueType.replace("_", " ").toLowerCase()}
                                {v.distanceMiles != null && ` · ${v.distanceMiles} mi`}
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="p-6 text-sm text-text-light">Select a venue to contact.</div>
          ) : selected.isPhoneOnly ? (
            /* ── Phone-only call panel ── */
            <div className="max-w-3xl mx-auto p-6 space-y-5">
              <div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-text">{selected.name}</div>
                  <span className="text-xs px-2 py-0.5 rounded bg-accent-blue-bg text-accent-blue border border-accent-blue/20">📞 Phone only</span>
                </div>
                <div className="text-sm text-text-medium mt-1">
                  {selected.decisionMakerName ?? `Unknown ${selected.decisionMakerRole ?? "contact"}`}
                  {" · "}
                  {selected.phone
                    ? <a href={`tel:${selected.phone}`} className="text-accent-blue hover:underline">{selected.phone}</a>
                    : <span className="text-amber">no phone on file</span>}
                </div>
                {selected.nearestShow && (
                  <div className="text-xs text-text-light mt-1">
                    Nearby show: {selected.nearestShow.venueName} · {selected.nearestShow.date}{selected.distanceMiles ? ` — ${selected.distanceMiles} mi` : ""}
                  </div>
                )}
              </div>

              {/* Call actions */}
              <div className="grid grid-cols-2 gap-3">
                {/* Call yourself */}
                <div className="border border-border rounded-lg p-4 bg-background space-y-3">
                  <div>
                    <p className="text-sm font-medium text-text flex items-center gap-1.5">
                      <PhoneCall size={14} className="text-success-green" /> Call yourself
                    </p>
                    <p className="text-xs text-text-light mt-0.5">Use the script below. Tap to dial on mobile.</p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => {
                      if (selected.phone) window.location.href = `tel:${selected.phone}`;
                    }}
                    disabled={!selected.phone}
                  >
                    <Phone size={13} />
                    {selected.phone ? `Call ${selected.phone}` : "No phone on file"}
                  </Button>
                  {!showCapture ? (
                    <button type="button" onClick={() => setShowCapture(true)} className="text-xs text-accent-blue hover:underline w-full text-center">
                      Got their email? Log it →
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <Input type="email" value={captureEmail} onChange={(e) => setCaptureEmail(e.target.value)} placeholder="booking@venue.com" />
                      <Input value={captureName} onChange={(e) => setCaptureName(e.target.value)} placeholder="Their name (optional)" />
                      <div className="flex gap-2">
                        <Button variant="primary" size="sm" className="flex-1"
                          disabled={!captureEmail || capturing}
                          onClick={async () => {
                            setCapturing(true);
                            try {
                              await fetch(`/api/venues/${selected.id}/capture-email`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ contactEmail: captureEmail, contactName: captureName || null }),
                              });
                              setCallStatus({ kind: "ok", msg: "Email captured — venue queued for outreach" });
                              setShowCapture(false);
                              setCaptureEmail(""); setCaptureName("");
                              const refreshed = await fetch("/api/outreach/venues").then((r) => r.json());
                              setVenues(refreshed);
                            } finally { setCapturing(false); }
                          }}>
                          {capturing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          Save
                        </Button>
                        <Button variant="default" size="sm" onClick={() => setShowCapture(false)}>✕</Button>
                      </div>
                    </div>
                  )}
                  {callStatus && (
                    <p className={`text-xs flex items-center gap-1 ${callStatus.kind === "ok" ? "text-success-green" : "text-amber"}`}>
                      {callStatus.kind === "ok" ? <Check size={11} /> : <AlertCircle size={11} />}
                      {callStatus.msg}
                    </p>
                  )}
                </div>

                {/* Nova AI call */}
                <div className="border border-purple/20 rounded-lg p-4 bg-purple-bg space-y-3">
                  <div>
                    <p className="text-sm font-medium text-text flex items-center gap-1.5">
                      <Bot size={14} className="text-purple" /> Nova AI call
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-bg border border-purple/30 text-purple">Pro</span>
                    </p>
                    <p className="text-xs text-text-light mt-0.5">Nova calls the venue, pitches Elijah, and captures an email for you.</p>
                  </div>
                  <div className="border border-purple/20 rounded p-2 bg-background text-xs text-text-medium space-y-0.5">
                    <div className="flex justify-between"><span>1 call</span><span className="font-medium">$0.35</span></div>
                    <div className="flex justify-between text-text-light"><span>Twilio + Nova</span><span>~90 sec</span></div>
                  </div>
                  <Button variant="default" size="sm" className="w-full justify-center border-purple/30 text-purple hover:bg-purple-bg" disabled>
                    <Bot size={13} />
                    Coming soon — Pro plan
                  </Button>
                </div>
              </div>

              {/* Voicemail script */}
              <div className="border border-border rounded-lg bg-background overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <div>
                    <h3 className="text-sm font-medium text-text">Voicemail script</h3>
                    <p className="text-xs text-text-light mt-0.5">Read if they don't pick up. Goal: get their email.</p>
                  </div>
                  <Button variant="default" size="sm"
                    onClick={async () => {
                      setGeneratingScript(true);
                      try {
                        const res = await fetch("/api/voice/voicemail-script", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ venueId: selected.id }),
                        });
                        const data = await res.json();
                        setVoicemailScript(data.script ?? "");
                      } finally { setGeneratingScript(false); }
                    }}
                    disabled={generatingScript}>
                    {generatingScript ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    {voicemailScript ? "Regenerate" : "Generate script"}
                  </Button>
                </div>
                {voicemailScript ? (
                  <div className="p-4">
                    <textarea
                      value={voicemailScript}
                      onChange={(e) => setVoicemailScript(e.target.value)}
                      rows={10}
                      className="w-full text-sm text-text bg-surface border border-border rounded-md p-3 font-mono leading-relaxed resize-y focus:outline-none focus:border-accent-blue"
                    />
                  </div>
                ) : (
                  <div className="px-4 py-8 text-center text-sm text-text-light">
                    Click "Generate script" for a personalized 30-second voicemail.
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── Email compose panel (existing) ── */
            <div className="max-w-3xl mx-auto p-6 space-y-5">
              <div>
                <div className="text-lg font-semibold text-text">{selected.name}</div>
                <div className="text-sm text-text-medium mt-1">
                  {selected.decisionMakerName ?? `Unknown ${selected.decisionMakerRole ?? "contact"}`}
                  {" · "}
                  {selected.contactEmail ?? <span className="text-amber">no email on file</span>}
                </div>
                {selected.nearestShow && (
                  <div className="text-xs text-text-light mt-1">
                    Nearby show: {selected.nearestShow.venueName} ({selected.nearestShow.city}) on{" "}
                    {selected.nearestShow.date}
                    {selected.distanceMiles ? ` — ${selected.distanceMiles} mi` : ""}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={handleGenerate} disabled={generating}>
                  <Sparkles size={13} />
                  {generating ? "Generating…" : email ? "Regenerate" : "Generate email"}
                </Button>
                {email && (
                  <span
                    className={`text-xs ${email.source === "claude" ? "text-success-green" : "text-amber"}`}
                    title={email.fallbackReason ?? undefined}
                  >
                    via {email.source === "claude" ? "Claude" : `template — ${email.fallbackReason ?? "no API key"}`}
                  </span>
                )}
              </div>

              {email && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-text-light">Subject</label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-text-light">Body</label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={14}
                      className="mt-1 w-full px-3 py-2 text-sm bg-white border border-border rounded-md font-mono text-text focus:outline-none focus:border-accent-blue resize-y"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="primary" size="sm" onClick={handleSend} disabled={sending}>
                      <Send size={13} />
                      {sending ? "Sending…" : "Send"}
                    </Button>
                    {statusMsg && (
                      <span
                        className={`flex items-center gap-1 text-xs ${
                          statusKind === "ok" ? "text-success-green" : "text-amber"
                        }`}
                      >
                        {statusKind === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}
                        {statusMsg}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {showPreview && (
        <SendPreviewModal
          onConfirm={(qualityOnly) => executeDrain(qualityOnly)}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
