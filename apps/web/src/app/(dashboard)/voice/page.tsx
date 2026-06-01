"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { buildScript, type ScriptVariant } from "@/lib/call-scripts";
import { Phone, Voicemail, PhoneOff, AlertCircle, Check, Loader2, type LucideIcon, PhoneCall, Mail, Sparkles, X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";

type QueueRow = {
  pipelineId: string;
  venueId: string;
  venueName: string;
  city: string;
  state: string;
  venueType: string;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  decisionMakerPhone: string | null;
  scriptVariant: ScriptVariant;
  stage: string;
  emailOpened: boolean;
  emailStatus: string | null;
  lastCallStatus: string | null;
  lastCalledAt: string | null;
  nearestShow: {
    venueName: string;
    city: string;
    date: string;
    distanceMiles: number;
  } | null;
  artistName: string;
  artistGenre: string;
};

const VARIANT_LABELS: Record<ScriptVariant, string> = {
  owner: "Owner / Manager",
  talent_buyer: "Talent Buyer",
  event_coordinator: "Event Coordinator",
};

const OUTCOMES: { value: "ANSWERED" | "VOICEMAIL" | "NO_ANSWER" | "FAILED"; label: string; icon: LucideIcon }[] = [
  { value: "ANSWERED", label: "Answered", icon: Phone },
  { value: "VOICEMAIL", label: "Voicemail", icon: Voicemail },
  { value: "NO_ANSWER", label: "No answer", icon: PhoneOff },
  { value: "FAILED", label: "Failed", icon: AlertCircle },
];

type PhoneVenue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venueType: string;
  phone: string | null;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  distanceMiles: number | null;
  narrative: string | null;
  pipelineStage: string | null;
  nearestShow: { venueName: string; city: string; date: string; distanceMiles: number | null } | null;
};

export default function VoicePage() {
  const [activeTab, setActiveTab] = useState<"nova" | "manual">("nova");
  const [queue, setQueue] = useState<QueueRow[]>([]);
  const [phoneQueue, setPhoneQueue] = useState<PhoneVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Voicemail script state
  const [voicemailScript, setVoicemailScript] = useState<string>("");
  const [scriptSource, setScriptSource] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);

  // Email capture state
  const [showCapture, setShowCapture] = useState(false);
  const [captureEmailValue, setCaptureEmailValue] = useState("");
  const [captureName, setCaptureName] = useState("");
  const [captureNotes, setCaptureNotes] = useState("");
  const [capturing, setCapturing] = useState(false);

  async function refresh() {
    const [novaData, phoneData] = await Promise.all([
      fetch("/api/voice/queue").then((r) => r.json()),
      fetch("/api/voice/phone-queue").then((r) => r.json()),
    ]);
    setQueue(novaData);
    setPhoneQueue(phoneData);
    setLoading(false);
    if (novaData.length && !selectedId) setSelectedId(novaData[0].venueId);
  }

  useEffect(() => {
    refresh();
  }, []);

  const selected = useMemo(
    () => queue.find((q) => q.venueId === selectedId) ?? null,
    [queue, selectedId]
  );

  const script = useMemo(() => {
    if (!selected) return null;
    return buildScript(
      {
        artistName: selected.artistName,
        artistGenre: selected.artistGenre,
        venueName: selected.venueName,
        decisionMakerFirstName: selected.decisionMakerName
          ? selected.decisionMakerName.split(" ")[0]
          : null,
        nearestShow: selected.nearestShow,
      },
      selected.scriptVariant
    );
  }, [selected]);

  async function generateVoicemailScript(venueId: string) {
    setGeneratingScript(true);
    setVoicemailScript("");
    try {
      const res = await fetch("/api/voice/voicemail-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId }),
      });
      const data = await res.json();
      setVoicemailScript(data.script ?? "");
      setScriptSource(data.source ?? "template");
    } finally {
      setGeneratingScript(false);
    }
  }

  async function captureEmail(venueId: string) {
    if (!captureEmailValue) return;
    setCapturing(true);
    try {
      const res = await fetch(`/api/venues/${venueId}/capture-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: captureEmailValue,
          contactName: captureName || null,
          notes: captureNotes || null,
        }),
      });
      if (!res.ok) throw new Error("Capture failed");
      setStatus({ kind: "ok", msg: `Email captured — venue queued for outreach` });
      setShowCapture(false);
      setCaptureEmailValue("");
      setCaptureName("");
      setCaptureNotes("");
      await refresh();
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setCapturing(false);
    }
  }

  const selectedPhoneVenue = phoneQueue.find((v) => v.id === selectedPhoneId) ?? null;

  async function simulate(outcome: "ANSWERED" | "VOICEMAIL" | "NO_ANSWER" | "FAILED") {
    if (!selected) return;
    setSimulating(true);
    setStatus(null);
    try {
      const res = await fetch("/api/voice/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueId: selected.venueId, outcome }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus({ kind: "ok", msg: `Logged: ${outcome}` });
      await refresh();
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Failed" });
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Voice"
        description="Nova AI calls + manual outreach for phone-only venues"
      />

      {/* Tab bar */}
      <div className="flex border-b border-border bg-background px-4 gap-1 pt-2">
        {[
          { id: "nova" as const, label: "Nova (AI calls)", count: queue.length },
          { id: "manual" as const, label: "Call yourself", count: phoneQueue.length, badge: phoneQueue.length > 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-accent-blue text-text font-medium"
                : "border-transparent text-text-medium hover:text-text"
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              tab.badge && activeTab !== tab.id
                ? "bg-accent-blue text-white"
                : "bg-surface text-text-light"
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Manual call tab ── */}
        {activeTab === "manual" && (
          <>
            <aside className="w-80 border-r border-border bg-surface overflow-y-auto shrink-0">
              <div className="px-4 py-3 border-b border-border bg-background">
                <p className="text-xs uppercase tracking-wide text-text-light">Phone-only venues</p>
                <p className="text-sm font-medium text-text mt-0.5">
                  {phoneQueue.length} venue{phoneQueue.length === 1 ? "" : "s"} · no email on file
                </p>
                <p className="text-xs text-text-light mt-1">
                  Call each one, get their email, and Gigify sends the booking link automatically.
                </p>
              </div>
              {loading ? (
                <div className="px-4 py-6 text-sm text-text-light">Loading…</div>
              ) : phoneQueue.length === 0 ? (
                <div className="px-4 py-6 text-sm text-text-light">
                  No phone-only venues. All venues have been enriched or have no phone.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {phoneQueue.map((v) => {
                    const active = v.id === selectedPhoneId;
                    return (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPhoneId(v.id);
                            setVoicemailScript("");
                            setShowCapture(false);
                            setStatus(null);
                          }}
                          className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition ${
                            active ? "bg-white border-l-2 border-accent-blue" : ""
                          }`}
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-text truncate">{v.name}</span>
                            {v.nearestShow && (
                              <span className="text-[10px] text-text-light shrink-0">
                                {new Date(v.nearestShow.date + "T12:00:00Z").toLocaleDateString("en-US", {
                                  month: "short", day: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-text-light mt-0.5">
                            {v.city}, {v.state} · {v.venueType.replace("_", " ").toLowerCase()}
                          </div>
                          {v.phone && (
                            <div className="text-xs text-accent-blue mt-0.5">{v.phone}</div>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </aside>

            <main className="flex-1 overflow-y-auto">
              {!selectedPhoneVenue ? (
                <div className="p-6 text-sm text-text-light">Select a venue to see the call script.</div>
              ) : (
                <div className="max-w-3xl mx-auto p-6 space-y-5">
                  {/* Venue header */}
                  <div>
                    <div className="text-lg font-semibold text-text">{selectedPhoneVenue.name}</div>
                    <div className="flex items-center gap-3 mt-1">
                      {selectedPhoneVenue.phone && (
                        <a
                          href={`tel:${selectedPhoneVenue.phone}`}
                          className="flex items-center gap-1.5 text-sm text-accent-blue hover:underline font-medium"
                        >
                          <Phone size={14} />
                          {selectedPhoneVenue.phone}
                        </a>
                      )}
                      {selectedPhoneVenue.nearestShow && (
                        <span className="flex items-center gap-1 text-xs text-text-light">
                          <MapPin size={11} />
                          {selectedPhoneVenue.nearestShow.venueName} ·{" "}
                          {selectedPhoneVenue.nearestShow.date} ·{" "}
                          {Math.round(selectedPhoneVenue.distanceMiles ?? 0)} mi
                        </span>
                      )}
                    </div>
                    {selectedPhoneVenue.narrative && (
                      <p className="text-xs text-text-medium mt-2 bg-surface border border-border rounded p-2">
                        {selectedPhoneVenue.narrative}
                      </p>
                    )}
                  </div>

                  {/* Voicemail script */}
                  <div className="border border-border rounded-lg bg-background overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                      <div>
                        <h3 className="text-sm font-medium text-text">Voicemail script</h3>
                        <p className="text-xs text-text-light mt-0.5">
                          Read this if they don't pick up. End goal: get their email.
                        </p>
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => generateVoicemailScript(selectedPhoneVenue.id)}
                        disabled={generatingScript}
                      >
                        {generatingScript ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Sparkles size={13} />
                        )}
                        {generatingScript ? "Writing…" : voicemailScript ? "Regenerate" : "Generate script"}
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
                        {scriptSource && (
                          <p className="text-xs text-text-light mt-1">
                            via {scriptSource === "claude" ? "Claude" : scriptSource === "custom_template" ? "your template" : "template"}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-sm text-text-light text-center">
                        Click "Generate script" for a personalized 30-second voicemail.
                      </div>
                    )}
                  </div>

                  {/* Capture email */}
                  {!showCapture ? (
                    <div className="flex gap-3">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowCapture(true)}
                      >
                        <Mail size={13} />
                        They gave me an email
                      </Button>
                      {status && (
                        <span className={`flex items-center gap-1 text-xs ${status.kind === "ok" ? "text-success-green" : "text-amber"}`}>
                          {status.kind === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}
                          {status.msg}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg bg-background p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-text">Capture contact info</h3>
                        <button type="button" onClick={() => setShowCapture(false)} className="text-text-light hover:text-text">
                          <X size={14} />
                        </button>
                      </div>
                      <p className="text-xs text-text-light">
                        Enter the email they gave you. Gigify will immediately queue a personalized email with Elijah's reel and booking link.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-xs uppercase tracking-wide text-text-light">Email *</label>
                          <Input
                            type="email"
                            value={captureEmailValue}
                            onChange={(e) => setCaptureEmailValue(e.target.value)}
                            placeholder="booking@venuename.com"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-text-light">Their name (optional)</label>
                          <Input
                            value={captureName}
                            onChange={(e) => setCaptureName(e.target.value)}
                            placeholder="Sarah Chen"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <label className="text-xs uppercase tracking-wide text-text-light">Notes (optional)</label>
                          <Input
                            value={captureNotes}
                            onChange={(e) => setCaptureNotes(e.target.value)}
                            placeholder="interested, call back Thursday"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => void captureEmail(selectedPhoneVenue.id)}
                        disabled={!captureEmailValue || capturing}
                      >
                        {capturing ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                        {capturing ? "Saving…" : "Save + queue email"}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </main>
          </>
        )}

        {/* ── Nova tab ── */}
        {activeTab === "nova" && (
        <>
        <aside className="w-80 border-r border-border bg-surface overflow-y-auto shrink-0">
          <div className="px-4 py-3 border-b border-border bg-background">
            <p className="text-xs uppercase tracking-wide text-text-light">Call queue</p>
            <p className="text-sm font-medium text-text mt-0.5">
              {queue.length} venue{queue.length === 1 ? "" : "s"} · email-opened first
            </p>
          </div>
          {loading ? (
            <div className="px-4 py-6 text-sm text-text-light">Loading…</div>
          ) : queue.length === 0 ? (
            <div className="px-4 py-6 text-sm text-text-light">
              No venues queued. Send outreach emails first.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {queue.map((q) => {
                const active = q.venueId === selectedId;
                return (
                  <li key={q.venueId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(q.venueId)}
                      className={`w-full text-left px-4 py-3 hover:bg-surface-hover transition ${
                        active ? "bg-white border-l-2 border-accent-blue" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-text truncate">
                          {q.venueName}
                        </span>
                        {q.emailOpened && (
                          <span className="text-[10px] uppercase tracking-wide text-purple shrink-0">
                            Opened
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-light mt-0.5">
                        {q.city}, {q.state} · {VARIANT_LABELS[q.scriptVariant]}
                      </div>
                      {q.lastCallStatus && (
                        <div className="text-xs text-text-light mt-0.5">
                          last: {q.lastCallStatus.toLowerCase()}
                        </div>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <main className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="p-6 text-sm text-text-light">Select a venue to preview the script.</div>
          ) : (
            <div className="max-w-3xl mx-auto p-6 space-y-5">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-text">{selected.venueName}</div>
                    <div className="text-sm text-text-medium mt-1">
                      {selected.decisionMakerName ?? `Unknown ${selected.decisionMakerRole ?? "contact"}`}
                      {" · "}
                      {selected.decisionMakerPhone ?? <span className="text-amber">no phone on file</span>}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-1 rounded bg-purple-bg text-purple border border-purple/20">
                    {VARIANT_LABELS[selected.scriptVariant]}
                  </span>
                </div>
                {selected.nearestShow && (
                  <div className="text-xs text-text-light mt-2">
                    Proximity proof: {selected.nearestShow.venueName} on {selected.nearestShow.date} ·{" "}
                    {selected.nearestShow.distanceMiles} mi
                  </div>
                )}
              </div>

              <div className="border border-border rounded-lg bg-background overflow-hidden">
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-medium text-text">Script</h3>
                </div>
                <div className="divide-y divide-border">
                  {script?.map((s) => (
                    <div key={s.label} className="px-4 py-3">
                      <p className="text-xs uppercase tracking-wide text-text-light mb-1">
                        {s.label}
                      </p>
                      <p className="text-sm text-text whitespace-pre-wrap">{s.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border border-border rounded-lg bg-background p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-medium text-text">Simulate call</h3>
                    <p className="text-xs text-text-light mt-0.5">
                      Twilio not wired — logs a Call row + advances pipeline.
                    </p>
                  </div>
                  {status && (
                    <span
                      className={`flex items-center gap-1 text-xs ${
                        status.kind === "ok" ? "text-success-green" : "text-amber"
                      }`}
                    >
                      {status.kind === "ok" ? <Check size={12} /> : <AlertCircle size={12} />}
                      {status.msg}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {OUTCOMES.map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant="default"
                      size="sm"
                      onClick={() => simulate(value)}
                      disabled={simulating}
                    >
                      {simulating ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
        </>
        )}
      </div>
    </div>
  );
}
