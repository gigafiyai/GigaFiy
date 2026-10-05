"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, Trash2 } from "lucide-react";
import { Avatar } from "@/components/marketing/avatar";

const SIZE = 512;

// Crop to a centred square and shrink to 512px in the browser, so any phone
// photo uploads quickly and stores small.
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Couldn't process that image.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process that image."))), "image/jpeg", 0.85)
  );
}

export function PhotoUpload({
  name,
  photoUrl,
  onChange,
}: {
  name: string;
  photoUrl: string | null;
  onChange: (url: string | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await toSquareJpeg(file);
      const body = new FormData();
      body.append("photo", blob, "photo.jpg");
      const res = await fetch("/api/artist/photo", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      onChange(data.photoUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/artist/photo", { method: "DELETE" });
      if (!res.ok) throw new Error("Couldn't remove the photo.");
      onChange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove the photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || "?"} photoUrl={photoUrl} size={72} />
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={input} type="file" accept="image/*" onChange={pick} className="hidden" />
          <button
            type="button" disabled={busy} onClick={() => input.current?.click()}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-border bg-surface text-text hover:bg-surface-hover disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {photoUrl ? "Change photo" : "Upload photo"}
          </button>
          {photoUrl && (
            <button type="button" disabled={busy} onClick={remove} className="inline-flex items-center gap-1.5 text-sm px-2 py-1.5 text-text-light hover:text-text disabled:opacity-50">
              <Trash2 size={13} /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-text-light mt-1.5">Shown on your booking page, gig pages and the Gigify home page. Saved as soon as you upload.</p>
        {error && <p className="text-xs text-amber mt-1">{error}</p>}
      </div>
    </div>
  );
}
