"use client";

import { useEffect, useMemo, useState } from "react";
import { Header } from "@/components/layout/header";
import { Calendar, type CalendarShow, type CalendarBlock } from "@/components/schedule/calendar";
import { DayModal } from "@/components/schedule/day-modal";
import { ChevronRight, Clock, MapPin, Users, DollarSign, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScheduleVenue = {
  id: string;
  name: string;
  city: string;
  state: string;
  venueType: string;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  distanceMiles: number | null;
  emailStatus: string | null;
  pipelineStage: string | null;
};

type ScheduleShow = {
  id: string;
  date: string;
  dayOfWeek: string;
  city: string;
  state: string;
  venueName: string;
  address: string;
  timeStart: string | null;
  timeEnd: string | null;
  showType: string;
  venueCount: number;
  contactedCount: number;
  revenue: number | null;
  fee: number | null;
  venues: ScheduleVenue[];
};

type AvailabilityBlock = {
  id: string;
  type: "BLOCKED" | "TRAVEL" | "PREFERRED_OFF";
  date: string;
  allDay: boolean;
  timeStart: string | null;
  timeEnd: string | null;
  reason: string | null;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STAGE_COLORS: Record<string, string> = {
  QUEUED: "text-text-light",
  EMAILED: "text-accent-blue",
  CALLED: "text-purple",
  INTERESTED: "text-purple",
  DEPOSIT: "text-amber",
  BOOKED: "text-success-green",
  CANCELLED: "text-text-light",
  DECLINED: "text-text-light",
};

function formatTimeRange(start: string | null, end: string | null): string {
  const fmt = (iso: string | null) =>
    iso
      ? new Date(iso).toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: "UTC",
        })
      : "TBD";
  if (!start && !end) return "TBD";
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  return fmt(start ?? end);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [shows, setShows] = useState<ScheduleShow[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingRevenue, setEditingRevenue] = useState<string | null>(null);
  const [revenueInput, setRevenueInput] = useState("");

  // Modal state
  const [modalDate, setModalDate] = useState<string | null>(null);
  const [modalBlock, setModalBlock] = useState<AvailabilityBlock | null>(null);

  async function refresh() {
    const [showsRes, blocksRes] = await Promise.all([
      fetch("/api/schedule").then((r) => r.json()),
      fetch("/api/availability").then((r) => r.json()),
    ]);
    setShows(showsRes);
    setBlocks(blocksRes);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDayClick(date: string, block: CalendarBlock | null) {
    setModalDate(date);
    // Resolve full block data from local state since CalendarBlock is a subset
    setModalBlock(block ? (blocks.find((b) => b.id === block.id) ?? null) : null);
  }

  async function handleSaveBlock(
    type: "BLOCKED" | "TRAVEL" | "PREFERRED_OFF",
    reason: string | null,
    allDay: boolean,
    timeStart: string | null,
    timeEnd: string | null
  ) {
    if (!modalDate) return;
    if (modalBlock) {
      await fetch(`/api/availability?id=${modalBlock.id}`, { method: "DELETE" });
    }
    await fetch("/api/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, date: modalDate, allDay, timeStart, timeEnd, reason }),
    });
    await refresh();
  }

  async function handleDeleteBlock() {
    if (!modalBlock) return;
    await fetch(`/api/availability?id=${modalBlock.id}`, { method: "DELETE" });
    await refresh();
  }

  // Data for the calendar component
  const calendarShows: CalendarShow[] = useMemo(
    () =>
      shows.map((s) => ({
        id: s.id,
        date: s.date,
        venueName: s.venueName,
        city: s.city,
        state: s.state,
        timeStart: s.timeStart,
        timeEnd: s.timeEnd,
        showType: s.showType,
        venueCount: s.venueCount,
      })),
    [shows]
  );

  const calendarBlocks: CalendarBlock[] = useMemo(
    () =>
      blocks.map((b) => ({
        id: b.id,
        date: b.date,
        type: b.type,
        reason: b.reason,
      })),
    [blocks]
  );

  const showsByDate = useMemo(() => {
    const m = new Map<string, ScheduleShow>();
    for (const s of shows) m.set(s.date, s);
    return m;
  }, [shows]);

  const modalShow = modalDate ? showsByDate.get(modalDate) ?? null : null;

  // Stats
  const totalBlocked = blocks.filter((b) => b.type === "BLOCKED" || b.type === "TRAVEL").length;
  const totalShows = shows.length;
  const totalVenues = shows.reduce((s, sh) => s + sh.venueCount, 0);
  const totalContacted = shows.reduce((s, sh) => s + sh.contactedCount, 0);
  const totalRevenue = shows.reduce((s, sh) => s + (sh.revenue ?? 0), 0);
  const avgFee = shows.filter((s) => s.revenue != null).length > 0
    ? Math.round(totalRevenue / shows.filter((s) => s.revenue != null).length)
    : null;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Schedule"
        description="Tour calendar — click any day to block availability"
      />

      {/* Stats bar */}
      <div className="flex items-stretch border-b border-border bg-surface divide-x divide-border">
        {[
          { label: "Confirmed shows", value: totalShows },
          { label: "Blocked days", value: totalBlocked },
          { label: "Venues discovered", value: totalVenues },
          { label: "Show revenue", value: totalRevenue > 0 ? `$${totalRevenue.toLocaleString()}` : "$0", green: true },
          { label: "Avg per show", value: avgFee != null ? `$${avgFee.toLocaleString()}` : "—" },
        ].map(({ label, value, green }: { label: string; value: string | number; green?: boolean }) => (
          <div key={label} className="flex flex-col px-5 py-3">
            <span className="text-xs text-text-light">{label}</span>
            <span className={`text-lg font-semibold ${green ? "text-success-green" : "text-text"}`}>{value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Calendar ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-6 text-sm text-text-light">Loading…</div>
          ) : (
            <Calendar
              shows={calendarShows}
              blocks={calendarBlocks}
              onDayClick={handleDayClick}
            />
          )}
        </div>

        {/* ── Show list sidebar ── */}
        <aside className="w-72 shrink-0 border-l border-border overflow-y-auto bg-surface flex flex-col">
          <div className="px-4 py-3 border-b border-border bg-background">
            <p className="text-sm font-medium text-text">Shows</p>
            <p className="text-xs text-text-light mt-0.5">
              {shows.length} confirmed · click to see nearby venues
            </p>
          </div>
          <div className="divide-y divide-border">
            {shows.map((s) => {
              const isOpen = expanded.has(s.id);
              return (
                <div key={s.id}>
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    className="w-full text-left px-4 py-3 hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-text-light">
                          {s.dayOfWeek.slice(0, 3)} ·{" "}
                          {new Date(s.date + "T12:00:00Z").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                        <p className="text-sm font-medium text-text truncate">
                          {s.venueName}
                        </p>
                        <p className="text-xs text-text-light">
                          {s.city}, {s.state}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs text-text-light">{s.venueCount}</span>
                        <ChevronRight
                          size={12}
                          className={`text-text-light transition-transform ${isOpen ? "rotate-90" : ""}`}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-light">
                      <span className="flex items-center gap-1">
                        <Clock size={10} />
                        {formatTimeRange(s.timeStart, s.timeEnd)}
                      </span>
                      {/* Revenue inline editor */}
                      {editingRevenue === s.id ? (
                        <div className="flex items-center gap-1 ml-auto" onClick={(e) => e.stopPropagation()}>
                          <span className="text-text-light">$</span>
                          <input
                            type="number"
                            className="w-16 text-xs px-1 py-0.5 border border-border rounded bg-elevated focus:outline-none focus:border-accent-blue"
                            value={revenueInput}
                            onChange={(e) => setRevenueInput(e.target.value)}
                            placeholder="0"
                            autoFocus
                          />
                          <button type="button" className="text-success-green" onClick={async () => {
                            const val = parseFloat(revenueInput);
                            await fetch(`/api/shows/${s.id}/revenue`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ revenue: isNaN(val) ? null : val }),
                            });
                            setEditingRevenue(null);
                            await refresh();
                          }}>
                            <Check size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex items-center gap-0.5 ml-auto text-text-light hover:text-success-green transition-colors"
                          onClick={(e) => { e.stopPropagation(); setEditingRevenue(s.id); setRevenueInput(s.revenue?.toString() ?? ""); }}
                          title="Log revenue for this show"
                        >
                          <DollarSign size={10} />
                          {s.revenue != null ? (
                            <span className="text-success-green font-medium">${s.revenue.toLocaleString()}</span>
                          ) : (
                            <span className="text-text-light">log revenue</span>
                          )}
                        </button>
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="bg-background px-4 py-2 border-t border-border">
                      {s.venues.length === 0 ? (
                        <p className="text-xs text-text-light py-1 flex items-center gap-1">
                          <Users size={11} />
                          No venues discovered yet
                        </p>
                      ) : (
                        <ul className="space-y-1.5 py-1">
                          {s.venues.slice(0, 8).map((v) => (
                            <li key={v.id} className="flex items-center justify-between">
                              <div className="min-w-0">
                                <p className="text-xs text-text font-medium truncate">
                                  {v.name}
                                </p>
                                <p className="text-[10px] text-text-light">
                                  {v.venueType.replace("_", " ").toLowerCase()}
                                  {v.distanceMiles != null && ` · ${v.distanceMiles} mi`}
                                </p>
                              </div>
                              {v.pipelineStage && (
                                <span
                                  className={`text-[10px] shrink-0 ml-1 ${
                                    STAGE_COLORS[v.pipelineStage] ?? "text-text-light"
                                  }`}
                                >
                                  {v.pipelineStage}
                                </span>
                              )}
                            </li>
                          ))}
                          {s.venues.length > 8 && (
                            <p className="text-[10px] text-text-light">
                              +{s.venues.length - 8} more
                            </p>
                          )}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      {/* Day modal */}
      {modalDate && (
        <DayModal
          date={modalDate}
          show={
            modalShow
              ? {
                  venueName: modalShow.venueName,
                  city: modalShow.city,
                  state: modalShow.state,
                  timeStart: modalShow.timeStart,
                  timeEnd: modalShow.timeEnd,
                  venueCount: modalShow.venueCount,
                }
              : null
          }
          block={modalBlock}
          onSave={handleSaveBlock}
          onDelete={handleDeleteBlock}
          onClose={() => {
            setModalDate(null);
            setModalBlock(null);
          }}
        />
      )}
    </div>
  );
}
