"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, AlertCircle, Loader2, KeyRound, Save } from "lucide-react";

type Artist = {
  id: string;
  name: string;
  genre: string;
  bio: string;
  drawDescription: string;
  hometown: string | null;
  instagramHandle: string | null;
  mailingAddress: string | null;
  voicemailScript: string | null;
  spotifyUrl: string | null;
  videoReelUrl: string | null;
  epkUrl: string | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  soundsLike: string | null;
  audienceProfile: string | null;
  performanceStyle: string | null;
  accolades: string | null;
  bookingAgentName: string | null;
};

type KeyStatus = { key: string; label: string; purpose: string; set: boolean };

type FieldDef = { key: keyof Artist; label: string; multiline?: boolean; placeholder?: string };
type Section = { title: string; hint?: string; fields: FieldDef[] };

const SECTIONS: Section[] = [
  {
    title: "Basics",
    fields: [
      { key: "name", label: "Artist name" },
      { key: "genre", label: "Genre" },
      { key: "hometown", label: "Hometown / based out of" },
      { key: "instagramHandle", label: "Instagram handle" },
      { key: "bio", label: "Bio", multiline: true },
    ],
  },
  {
    title: "What makes Tulio versed",
    hint: "These fill out Tulio's call brief and personalize every email — the difference between sounding generic and sounding like your real agent.",
    fields: [
      { key: "soundsLike", label: "Sounds like (2–3 comparable artists)", placeholder: "e.g. Gregory Alan Isakov, Iron & Wine" },
      { key: "audienceProfile", label: "Who comes to your shows", multiline: true, placeholder: "age, vibe, how many, bar spend" },
      { key: "performanceStyle", label: "Performance style", multiline: true, placeholder: "solo / duo / band · set length · originals vs covers" },
      { key: "accolades", label: "Accolades / proof points", multiline: true, placeholder: "streams, press, notable rooms, sellouts (or 'up-and-coming, no major press yet')" },
      { key: "drawDescription", label: "Typical draw" },
      { key: "bookingAgentName", label: "AI agent name", placeholder: "Tulio" },
    ],
  },
  {
    title: "Links & contact",
    fields: [
      { key: "spotifyUrl", label: "Spotify URL" },
      { key: "videoReelUrl", label: "Video reel URL" },
      { key: "epkUrl", label: "EPK URL" },
      { key: "mailingAddress", label: "Mailing address (required for email — CAN-SPAM)" },
      { key: "voicemailScript", label: "Personal voicemail template", multiline: true },
      { key: "contactName", label: "Contact name" },
      { key: "contactEmail", label: "Contact email" },
      { key: "contactPhone", label: "Contact phone" },
    ],
  },
];

export default function SettingsPage() {
  const [artist, setArtist] = useState<Artist | null>(null);
  const [keys, setKeys] = useState<KeyStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/artist").then((r) => r.json()),
      fetch("/api/settings/keys").then((r) => r.json()),
    ]).then(([a, k]) => {
      setArtist(a);
      setKeys(k);
      setLoading(false);
    });
  }, []);

  function update<K extends keyof Artist>(key: K, value: Artist[K]) {
    if (!artist) return;
    setArtist({ ...artist, [key]: value });
    setDirty(true);
    setStatus(null);
  }

  async function save() {
    if (!artist) return;
    setSaving(true);
    try {
      const res = await fetch("/api/artist", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artist),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const updated = await res.json();
      setArtist(updated);
      setDirty(false);
      setStatus({ kind: "ok", msg: "Saved" });
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Header title="Settings" description="API keys, artist profile, preferences" />
        <div className="p-6 text-sm text-text-light">Loading…</div>
      </div>
    );
  }
  if (!artist) {
    return (
      <div>
        <Header title="Settings" description="API keys, artist profile, preferences" />
        <div className="p-6 text-sm text-amber">No artist found. Re-run the seed.</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Settings"
        description="Artist profile and API keys"
        actions={
          <Button variant="primary" size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        }
      />

      <div className="p-6 space-y-6 overflow-y-auto">
        {status && (
          <div className={`flex items-center gap-1.5 text-xs ${status.kind === "ok" ? "text-success-green" : "text-amber"}`}>
            {status.kind === "ok" ? <Check size={12} /> : <AlertCircle size={12} />} {status.msg}
          </div>
        )}

        {SECTIONS.map((section) => (
          <section key={section.title} className="border border-border rounded-lg bg-background overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-text">{section.title}</h3>
              {section.hint && <p className="text-xs text-text-light mt-0.5">{section.hint}</p>}
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              {section.fields.map(({ key, label, multiline, placeholder }) => (
                <div key={key} className={multiline ? "col-span-2" : ""}>
                  <label className="text-xs uppercase tracking-wide text-text-light">{label}</label>
                  {multiline ? (
                    <textarea
                      value={(artist[key] as string | null) ?? ""}
                      onChange={(e) => update(key, e.target.value as Artist[typeof key])}
                      rows={3}
                      placeholder={placeholder}
                      className="mt-1 w-full px-3 py-2 text-sm bg-elevated border border-border rounded-md text-text focus:outline-none focus:border-accent-blue resize-y placeholder:text-text-light"
                    />
                  ) : (
                    <Input
                      value={(artist[key] as string | null) ?? ""}
                      onChange={(e) => update(key, e.target.value as Artist[typeof key])}
                      placeholder={placeholder}
                      className="mt-1"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

        <section className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-text flex items-center gap-1.5">
              <KeyRound size={14} className="text-text-light" />
              API keys
            </h3>
            <p className="text-xs text-text-light mt-0.5">
              Read-only status. Edit the values in <code className="text-text-medium">.env</code> at the project root, then restart the dev server.
            </p>
          </div>
          <div className="divide-y divide-border">
            {keys.map((k) => (
              <div
                key={k.key}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text">{k.label}</span>
                    <code className="text-xs text-text-light">{k.key}</code>
                  </div>
                  <p className="text-xs text-text-light mt-0.5">{k.purpose}</p>
                </div>
                {k.set ? (
                  <span className="flex items-center gap-1 text-xs text-success-green px-2 py-1 rounded bg-success-green-bg border border-success-green/20">
                    <Check size={12} /> Set
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-text-light px-2 py-1 rounded bg-surface border border-border">
                    Not set
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
