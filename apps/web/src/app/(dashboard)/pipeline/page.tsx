"use client";

import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { StagePill } from "@/components/pipeline/stage-badge";
import { PipelineTable } from "@/components/pipeline/pipeline-table";
import type { PipelineRow, PipelineStage } from "@/lib/types";
import { Download, Loader2, RefreshCw } from "lucide-react";

const STAGE_FILTERS: Array<PipelineStage | "ALL"> = [
  "ALL",
  "QUEUED",
  "EMAILED",
  "CALLED",
  "INTERESTED",
  "DEPOSIT",
  "BOOKED",
  "DECLINED",
];

export default function PipelinePage() {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<PipelineStage | "ALL">("ALL");
  const [liveMusicOnly, setLiveMusicOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [launchSummary, setLaunchSummary] = useState<string | null>(null);
  const [rebooking, setRebooking] = useState(false);

  async function refresh() {
    try {
      const r = await fetch("/api/pipeline");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: PipelineRow[] = await r.json();
      setRows(data);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function rebook() {
    setRebooking(true);
    try {
      const res = await fetch("/api/pipeline/rebooking", { method: "POST" });
      const data = await res.json();
      if (res.ok) setLaunchSummary(`↺ ${data.rebookedVenues} venues queued for re-booking follow-up`);
      await refresh();
    } catch { /* silent */ } finally {
      setRebooking(false);
    }
  }

  function exportCsv() {
    const stageParam = activeStage !== "ALL" ? `?stage=${activeStage}` : "";
    window.location.href = `/api/pipeline/export${stageParam}`;
  }

  const filtered = useMemo(() => {
    let r = activeStage === "ALL" ? rows : rows.filter((r) => r.stage === activeStage);
    if (liveMusicOnly) r = r.filter((r) => r.hostsLiveMusic === true || r.venueType === "MUSIC_CLUB" || r.venueType === "BAR" || r.venueType === "ARTS_CENTER");
    return r;
  }, [activeStage, liveMusicOnly, rows]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: rows.length };
    for (const row of rows) {
      counts[row.stage] = (counts[row.stage] ?? 0) + 1;
    }
    return counts;
  }, [rows]);

  const stats = useMemo(() => {
    const booked = rows.filter((r) => r.stage === "BOOKED");
    const revenue = booked.reduce((sum, r) => sum + (r.bookedShowFee ?? 0), 0);
    const deposits = rows
      .filter((r) => r.depositPaidAt)
      .reduce((sum, r) => sum + (r.depositAmount ?? 0), 0);
    return {
      total: rows.length,
      contacted: rows.filter((r) => r.stage !== "QUEUED").length,
      interested: rows.filter(
        (r) => r.stage === "INTERESTED" || r.stage === "DEPOSIT" || r.stage === "BOOKED"
      ).length,
      booked: booked.length,
      revenue,
      deposits,
    };
  }, [rows]);

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Pipeline"
        description="Venue outreach CRM — Elijah Stone campaign"
        actions={
          <div className="flex items-center gap-2">
            {launchSummary && (
              <span className="text-xs text-text-light max-w-xs truncate" title={launchSummary}>
                {launchSummary}
              </span>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={rebook}
              disabled={rebooking}
              title="Queue re-booking follow-ups for venues booked 90+ days ago"
            >
              {rebooking ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Rebook
            </Button>
            <Button variant="default" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={13} />
              Export{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
          </div>
        }
      />

      <div className="flex items-stretch border-b border-border bg-surface divide-x divide-border">
        {[
          { label: "Total", value: stats.total },
          { label: "Contacted", value: stats.contacted },
          { label: "Interested", value: stats.interested },
          { label: "Booked", value: stats.booked },
          {
            label: "Revenue",
            value: `$${stats.revenue.toLocaleString()}`,
            highlight: true,
          },
          {
            label: "Deposits",
            value: `$${stats.deposits.toLocaleString()}`,
          },
        ].map(({ label, value, highlight }) => (
          <div key={label} className="flex flex-col px-5 py-3 min-w-[100px]">
            <span className="text-xs text-text-light">{label}</span>
            <span
              className={
                highlight
                  ? "text-lg font-semibold text-success-green"
                  : "text-lg font-semibold text-text"
              }
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-border overflow-x-auto">
        <button
          type="button"
          onClick={() => setLiveMusicOnly(!liveMusicOnly)}
          className={`text-xs px-2.5 py-1 rounded-full border transition-colors shrink-0 flex items-center gap-1 ${
            liveMusicOnly
              ? "bg-success-green text-white border-success-green"
              : "bg-surface border-border text-text-medium hover:bg-surface-hover"
          }`}
        >
          🎵 Live music only
          {liveMusicOnly && <span className="ml-0.5 opacity-70">✓</span>}
        </button>
        <div className="w-px h-4 bg-border mx-1 shrink-0" />
      </div>
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border overflow-x-auto">
        {STAGE_FILTERS.map((stage) => (
          <div key={stage} className="flex items-center gap-1 shrink-0">
            <StagePill
              stage={stage}
              active={activeStage === stage}
              onClick={() => {
                setActiveStage(stage);
                setSelectedIds(new Set());
              }}
            />
            <span className="text-xs text-text-light">
              {stageCounts[stage] ?? 0}
            </span>
          </div>
        ))}
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-blue-bg border-b border-accent-blue/20">
          <span className="text-xs text-accent-blue font-medium">{selectedIds.size} selected</span>
          <button type="button" onClick={() => setSelectedIds(new Set())} className="text-accent-blue hover:opacity-70 text-xs">clear</button>
          <span className="text-xs text-text-light ml-1">— use Export, or run outreach from the Campaigns tab</span>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="px-4 py-8 text-sm text-text-light">Loading pipeline…</div>
        ) : error ? (
          <div className="px-4 py-8 text-sm text-amber">Failed to load: {error}</div>
        ) : (
          <PipelineTable
            rows={filtered}
            onChange={refresh}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        )}
      </div>
    </div>
  );
}
