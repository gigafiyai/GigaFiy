"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Phone, AlertCircle, Check, Loader2, PhoneCall, Mail, Sparkles, X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LogCallModal } from "@/components/voice/log-call-modal";
import { TulioCallPanel } from "@/components/voice/tulio-call-panel";

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
  const [activeTab, setActiveTab] = useState<"tulio" | "manual">("tulio");
  const [phoneQueue, setPhoneQueue] = useState<PhoneVenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoneId, setSelectedPhoneId] = useState<string | null>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Voicemail script state
  const [voicemailScript, setVoicemailScript] = useState<string>("");
  const [scriptSource, setScriptSource] = useState<string | null>(null);
  const [generatingScript, setGeneratingScript] = useState(false);

  // Email capture state
  const [showCapture, setShowCapture] = useState(false);
  const [showLogCall, setShowLogCall] = useState(false);
  const [captureEmailValue, setCaptureEmailValue] = useState("");
  const [captureName, setCaptureName] = useState("");
  const [captureNotes, setCaptureNotes] = useState("");
  const [capturing, setCapturing] = useState(false);

  async function refresh() {
    const phoneData = await fetch("/api/voice/phone-queue").then((r) => r.json());
    setPhoneQueue(phoneData);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

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

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Voice"
        description="Tulio AI booking calls + manual outreach for phone-only venues"
      />

      {/* Tab bar */}
      <div className="flex border-b border-border bg-background px-4 gap-1 pt-2">
        {[
          { id: "tulio" as const, label: "Tulio (AI booking agent)", count: phoneQueue.length, badge: phoneQueue.length > 0 },
          { id: "manual" as const, label: "Call yourself", count: phoneQueue.length },
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
        {/* ── Tulio AI booking-agent tab ── */}
        {activeTab === "tulio" && <TulioCallPanel />}

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
                            active ? "bg-elevated border-l-2 border-accent-blue" : ""
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

                  {/* Post-call actions */}
                  {!showCapture ? (
                    <div className="flex gap-2 items-center flex-wrap">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setShowLogCall(true)}
                      >
                        <PhoneCall size={13} />
                        Log call result
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => setShowCapture(true)}
                      >
                        <Mail size={13} />
                        Just add an email
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
      </div>

      {showLogCall && selectedPhoneVenue && (
        <LogCallModal
          venueId={selectedPhoneVenue.id}
          venueName={selectedPhoneVenue.name}
          onClose={() => setShowLogCall(false)}
          onLogged={() => { void refresh(); }}
        />
      )}
    </div>
  );
}
