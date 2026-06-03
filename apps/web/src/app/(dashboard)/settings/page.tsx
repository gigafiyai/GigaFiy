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
};

type KeyStatus = { key: string; label: string; purpose: string; set: boolean };

const FIELDS: Array<{ key: keyof Artist; label: string; multiline?: boolean }> = [
  { key: "name", label: "Artist name" },
  { key: "genre", label: "Genre" },
  { key: "hometown", label: "Hometown / based out of" },
  { key: "instagramHandle", label: "Instagram handle" },
  { key: "mailingAddress", label: "Mailing address (required for email — CAN-SPAM)" },
  { key: "bio", label: "Bio", multiline: true },
  { key: "voicemailScript", label: "Personal voicemail template", multiline: true },
  { key: "drawDescription", label: "Typical draw" },
  { key: "spotifyUrl", label: "Spotify URL" },
  { key: "videoReelUrl", label: "Video reel URL" },
  { key: "epkUrl", label: "EPK URL" },
  { key: "contactName", label: "Contact name" },
  { key: "contactEmail", label: "Contact email" },
  { key: "contactPhone", label: "Contact phone" },
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
        <section className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-text">Artist profile</h3>
              <p className="text-xs text-text-light mt-0.5">
                These values feed every email subject, body, and call script.
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
          <div className="p-4 grid grid-cols-2 gap-4">
            {FIELDS.map(({ key, label, multiline }) => (
              <div
                key={key}
                className={multiline ? "col-span-2" : ""}
              >
                <label className="text-xs uppercase tracking-wide text-text-light">
                  {label}
                </label>
                {multiline ? (
                  <textarea
                    value={(artist[key] as string | null) ?? ""}
                    onChange={(e) => update(key, e.target.value as Artist[typeof key])}
                    rows={4}
                    className="mt-1 w-full px-3 py-2 text-sm bg-white border border-border rounded-md text-text focus:outline-none focus:border-accent-blue resize-y"
                  />
                ) : (
                  <Input
                    value={(artist[key] as string | null) ?? ""}
                    onChange={(e) => update(key, e.target.value as Artist[typeof key])}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
          </div>
        </section>

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
