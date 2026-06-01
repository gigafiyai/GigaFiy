"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Music2, AlertTriangle, Plane, MinusCircle, Plus } from "lucide-react";

export type CalendarShow = {
  id: string;
  date: string; // YYYY-MM-DD
  venueName: string;
  city: string;
  state: string;
  timeStart: string | null;
  timeEnd: string | null;
  showType: string;
  venueCount: number;
};

export type CalendarBlock = {
  id: string;
  date: string; // YYYY-MM-DD
  type: "BLOCKED" | "TRAVEL" | "PREFERRED_OFF";
  reason: string | null;
};

type DayState = "show" | "blocked" | "travel" | "preferred_off" | "available" | "past";

type Props = {
  shows: CalendarShow[];
  blocks: CalendarBlock[];
  onDayClick: (date: string, existingBlock: CalendarBlock | null) => void;
};

const MONTHS = [
  { year: 2026, month: 5 }, // June (0-indexed)
  { year: 2026, month: 6 }, // July
  { year: 2026, month: 7 }, // August
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const TYPE_CONFIG = {
  BLOCKED: {
    bg: "bg-amber-bg border-amber/40",
    dot: "bg-amber",
    icon: AlertTriangle,
    text: "text-amber",
    label: "Blocked",
  },
  TRAVEL: {
    bg: "bg-accent-blue-bg border-accent-blue/40",
    dot: "bg-accent-blue",
    icon: Plane,
    text: "text-accent-blue",
    label: "Travel",
  },
  PREFERRED_OFF: {
    bg: "bg-surface border-border-medium",
    dot: "bg-text-light",
    icon: MinusCircle,
    text: "text-text-light",
    label: "Prefer off",
  },
};

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function Calendar({ shows, blocks, onDayClick }: Props) {
  const [visibleMonth, setVisibleMonth] = useState(0); // index into MONTHS

  const showsByDate = useMemo(() => {
    const m = new Map<string, CalendarShow>();
    for (const s of shows) m.set(s.date, s);
    return m;
  }, [shows]);

  const blocksByDate = useMemo(() => {
    const m = new Map<string, CalendarBlock>();
    for (const b of blocks) m.set(b.date, b);
    return m;
  }, [blocks]);

  const today = new Date().toISOString().slice(0, 10);

  function getDayState(iso: string): DayState {
    if (iso < today) return "past";
    if (blocksByDate.has(iso)) {
      const t = blocksByDate.get(iso)!.type;
      if (t === "BLOCKED") return "blocked";
      if (t === "TRAVEL") return "travel";
      return "preferred_off";
    }
    if (showsByDate.has(iso)) return "show";
    return "available";
  }

  const { year, month } = MONTHS[visibleMonth];
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Build 6-row grid (up to 42 cells).
  const cells: Array<number | null> = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex flex-col h-full">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button
          type="button"
          onClick={() => setVisibleMonth((v) => Math.max(0, v - 1))}
          disabled={visibleMonth === 0}
          className="p-1 rounded hover:bg-surface disabled:opacity-30 transition"
        >
          <ChevronLeft size={16} />
        </button>
        <h2 className="text-sm font-semibold text-text">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          type="button"
          onClick={() => setVisibleMonth((v) => Math.min(MONTHS.length - 1, v + 1))}
          disabled={visibleMonth === MONTHS.length - 1}
          className="p-1 rounded hover:bg-surface disabled:opacity-30 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* DOW header */}
      <div className="grid grid-cols-7 border-b border-border">
        {DOW.map((d) => (
          <div
            key={d}
            className="text-center py-2 text-xs font-medium text-text-light uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1 divide-x divide-border border-b border-border overflow-hidden">
        {cells.map((day, idx) => {
          if (!day) {
            return (
              <div
                key={`empty-${idx}`}
                className="bg-surface border-b border-border min-h-[80px]"
              />
            );
          }

          const iso = toIso(year, month, day);
          const state = getDayState(iso);
          const show = showsByDate.get(iso);
          const block = blocksByDate.get(iso);
          const isToday = iso === today;

          const stateStyles: Record<DayState, string> = {
            available: "bg-background hover:bg-surface cursor-pointer",
            show: "bg-background hover:bg-surface cursor-pointer",
            blocked: "bg-amber-bg hover:opacity-90 cursor-pointer",
            travel: "bg-accent-blue-bg hover:opacity-90 cursor-pointer",
            preferred_off: "bg-surface hover:bg-surface-hover cursor-pointer",
            past: "bg-surface opacity-50 cursor-default",
          };

          return (
            <div
              key={iso}
              role={state !== "past" ? "button" : undefined}
              tabIndex={state !== "past" ? 0 : undefined}
              onClick={() =>
                state !== "past" && onDayClick(iso, block ?? null)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" && state !== "past")
                  onDayClick(iso, block ?? null);
              }}
              className={`border-b border-border min-h-[80px] p-1.5 flex flex-col gap-1 transition-colors ${stateStyles[state]}`}
            >
              {/* Date number */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full
                    ${isToday ? "bg-accent-blue text-white" : state === "past" ? "text-text-light" : "text-text"}`}
                >
                  {day}
                </span>
                {state === "available" && (
                  <Plus
                    size={10}
                    className="text-text-light opacity-0 group-hover:opacity-100"
                  />
                )}
              </div>

              {/* Show badge */}
              {show && (
                <div className="flex items-start gap-1">
                  <Music2 size={10} className="text-success-green shrink-0 mt-0.5" />
                  <span className="text-[10px] leading-tight text-success-green font-medium line-clamp-2">
                    {show.venueName}
                    {show.timeStart && (
                      <span className="block text-[9px] text-text-light font-normal">
                        {formatTime(show.timeStart)}
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Block badge */}
              {block && (
                <div className="flex items-start gap-1">
                  {(() => {
                    const cfg = TYPE_CONFIG[block.type];
                    const Icon = cfg.icon;
                    return (
                      <>
                        <Icon size={10} className={`${cfg.text} shrink-0 mt-0.5`} />
                        <span className={`text-[10px] leading-tight ${cfg.text} font-medium line-clamp-2`}>
                          {cfg.label}
                          {block.reason && (
                            <span className="block text-[9px] text-text-light font-normal">
                              {block.reason}
                            </span>
                          )}
                        </span>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* Split-day indicator — morning/evening slot available on show day */}
              {show && show.timeStart && (
                <div className="mt-auto flex items-center gap-1">
                  <div className="flex-1 h-1 rounded-full bg-border overflow-hidden flex">
                    {/* Visual time bar: shows when the artist is busy vs free */}
                    {(() => {
                      const startH = new Date(show.timeStart).getUTCHours() + new Date(show.timeStart).getUTCMinutes() / 60;
                      const endH = show.timeEnd
                        ? new Date(show.timeEnd).getUTCHours() + new Date(show.timeEnd).getUTCMinutes() / 60
                        : startH + 2;
                      const dayHours = 14; // 9am to 11pm = 14 hours
                      const startPct = Math.max(0, ((startH - 9) / dayHours) * 100);
                      const widthPct = Math.min(100 - startPct, ((endH - startH) / dayHours) * 100);
                      return (
                        <>
                          <div style={{ width: `${startPct}%` }} className="bg-success-green/20 h-full" />
                          <div style={{ width: `${widthPct}%` }} className="bg-success-green h-full" />
                          <div className="flex-1 bg-success-green/20 h-full" />
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
              {show && show.venueCount > 0 && (
                <span className="text-[9px] text-text-light">
                  {show.venueCount} nearby
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-border">
        <div className="flex items-center gap-1.5">
          <Music2 size={11} className="text-success-green" />
          <span className="text-xs text-text-light">Confirmed show</span>
        </div>
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={type} className="flex items-center gap-1.5">
              <Icon size={11} className={cfg.text} />
              <span className="text-xs text-text-light">{cfg.label}</span>
            </div>
          );
        })}
        <span className="text-xs text-text-light ml-2">Click any available day to block it</span>
      </div>
    </div>
  );
}
