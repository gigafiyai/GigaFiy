"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, Plane, MinusCircle, Check, Trash2, X, Music2, type LucideIcon
} from "lucide-react";

type BlockType = "BLOCKED" | "TRAVEL" | "PREFERRED_OFF";

type Show = {
  venueName: string;
  city: string;
  state: string;
  timeStart: string | null;
  timeEnd: string | null;
  venueCount: number;
};

type Block = {
  id: string;
  type: BlockType;
  reason: string | null;
  allDay: boolean;
  timeStart: string | null;
  timeEnd: string | null;
};

type Props = {
  date: string; // YYYY-MM-DD
  show: Show | null;
  block: Block | null;
  onSave: (type: BlockType, reason: string | null, allDay: boolean, timeStart: string | null, timeEnd: string | null) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
};

const TYPE_CONFIG: Record<BlockType, { label: string; icon: LucideIcon; description: string; bg: string; text: string }> = {
  BLOCKED: {
    label: "Blocked",
    icon: AlertTriangle,
    description: "Hard unavailable. Never suggested in emails.",
    bg: "border-amber/40 bg-amber-bg",
    text: "text-amber",
  },
  TRAVEL: {
    label: "Travel day",
    icon: Plane,
    description: "In transit. Never suggested in emails.",
    bg: "border-accent-blue/40 bg-accent-blue-bg",
    text: "text-accent-blue",
  },
  PREFERRED_OFF: {
    label: "Prefer off",
    icon: MinusCircle,
    description: "Soft block. Ranked lower in email suggestions.",
    bg: "border-border bg-surface",
    text: "text-text-medium",
  },
};

function formatDatePretty(iso: string): string {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string | null): string {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function DayModal({ date, show, block, onSave, onDelete, onClose }: Props) {
  const [selectedType, setSelectedType] = useState<BlockType>(block?.type ?? "BLOCKED");
  const [reason, setReason] = useState(block?.reason ?? "");
  const [allDay, setAllDay] = useState(block?.allDay ?? true);
  const [timeStart, setTimeStart] = useState(block?.timeStart ? new Date(block.timeStart).toTimeString().slice(0, 5) : "09:00");
  const [timeEnd, setTimeEnd] = useState(block?.timeEnd ? new Date(block.timeEnd).toTimeString().slice(0, 5) : "17:00");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const tsIso = !allDay && timeStart ? `${date}T${timeStart}:00Z` : null;
      const teIso = !allDay && timeEnd ? `${date}T${timeEnd}:00Z` : null;
      await onSave(selectedType, reason || null, allDay, tsIso, teIso);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-4 py-3 border-b border-border">
          <div>
            <p className="text-sm font-semibold text-text">{formatDatePretty(date)}</p>
            {show && (
              <div className="flex items-center gap-1.5 mt-1">
                <Music2 size={12} className="text-success-green" />
                <p className="text-xs text-success-green font-medium">
                  {show.venueName} — {show.city}, {show.state}
                  {show.timeStart && (
                    <span className="text-text-light font-normal">
                      {" "}· {formatTime(show.timeStart)}
                      {show.timeEnd ? ` – ${formatTime(show.timeEnd)}` : ""}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-text-light hover:text-text">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-4 py-4 space-y-3">
          {show && !block && (
            <p className="text-xs text-text-light border border-border rounded p-2 bg-surface">
              This is already a show day. You can still block adjacent time or note travel.
            </p>
          )}

          <p className="text-xs uppercase tracking-wide text-text-light font-medium">
            {block ? "Edit availability block" : "Block this day"}
          </p>

          {/* Type selector */}
          <div className="space-y-2">
            {(Object.entries(TYPE_CONFIG) as [BlockType, typeof TYPE_CONFIG[BlockType]][]).map(
              ([type, cfg]) => {
                const Icon = cfg.icon;
                const active = selectedType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`w-full flex items-start gap-3 px-3 py-2.5 rounded border text-left transition-colors ${
                      active ? cfg.bg : "border-border bg-background hover:bg-surface"
                    }`}
                  >
                    <Icon size={14} className={`${active ? cfg.text : "text-text-light"} mt-0.5 shrink-0`} />
                    <div>
                      <p className={`text-sm font-medium ${active ? cfg.text : "text-text"}`}>
                        {cfg.label}
                      </p>
                      <p className="text-xs text-text-light mt-0.5">{cfg.description}</p>
                    </div>
                    {active && <Check size={14} className={`${cfg.text} ml-auto shrink-0 mt-0.5`} />}
                  </button>
                );
              }
            )}
          </div>

          {/* All day toggle */}
          <div className="border border-border rounded p-3 bg-surface space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-text">All day</span>
              <button
                type="button"
                onClick={() => setAllDay(!allDay)}
                className={`w-10 h-5 rounded-full transition-colors relative ${allDay ? "bg-accent-blue" : "bg-border-medium"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${allDay ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </label>
            {!allDay && (
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1">
                  <label className="text-xs text-text-light">From</label>
                  <input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
                    className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-border bg-white focus:outline-none focus:border-accent-blue"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-text-light">To</label>
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
                    className="mt-1 w-full text-sm px-2 py-1.5 rounded border border-border bg-white focus:outline-none focus:border-accent-blue"
                  />
                </div>
              </div>
            )}
            {!allDay && (
              <p className="text-xs text-text-light">
                Available-dates engine will avoid suggesting times that overlap this block.
              </p>
            )}
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs uppercase tracking-wide text-text-light">
              Reason (optional)
            </label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="recording, family, travel, rest day…"
              className="mt-1"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 pb-4">
          {block && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              <Trash2 size={13} />
              {deleting ? "Removing…" : "Remove block"}
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            className="ml-auto"
            onClick={handleSave}
            disabled={saving || deleting}
          >
            <Check size={13} />
            {saving ? "Saving…" : block ? "Update" : "Block this day"}
          </Button>
        </div>
      </div>
    </div>
  );
}
