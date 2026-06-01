"use client";

import { useState, useMemo, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { StagePill } from "@/components/pipeline/stage-badge";
import { PipelineTable } from "@/components/pipeline/pipeline-table";
import { BulkActions } from "@/components/pipeline/bulk-actions";
import type { PipelineRow, PipelineStage } from "@/lib/types";
import { Zap, Download, Loader2 } from "lucide-react";

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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [launching, setLaunching] = useState(false);
  const [launchSummary, setLaunchSummary] = useState<string | null>(null);

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

  async function launchCampaign() {
    const ids = [...selectedIds];
    const hasSelection = ids.length > 0;
    if (
      !hasSelection &&
      !confirm("Send to ALL QUEUED venues with a contact email? (use checkboxes to send to specific rows instead)")
    ) {
      return;
    }
    setLaunching(true);
    setLaunchSummary(null);
    try {
      const res = await fetch("/api/outreach/send-all-queued", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hasSelection ? { pipelineIds: ids } : { limit: 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setLaunchSummary(
        `Sent ${data.sent} · skipped ${data.skippedNoEmail} no-email · ${data.errors} errors · ${data.remainingQueued} queued remaining`
      );
      setSelectedIds(new Set());
      await refresh();
    } catch (e) {
      setLaunchSummary(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setLaunching(false);
    }
  }

  function exportCsv() {
    const target = selectedIds.size > 0 ? rows.filter((r) => selectedIds.has(r.id)) : filtered;
    if (target.length === 0) return;
    const header = [
      "venue", "city", "state", "type", "decisionMaker", "role", "email", "phone",
      "stage", "emailStatus", "callStatus", "depositAmount", "bookedShowDate", "bookedShowFee",
      "nearestShow", "nearestShowDate", "distanceMiles",
    ];
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rowsCsv = target.map((r) =>
      [
        r.venueName, r.city, r.state, r.venueType,
        r.decisionMakerName ?? "", r.decisionMakerRole ?? "",
        r.decisionMakerEmail ?? r.venueEmail ?? "",
        r.decisionMakerPhone ?? r.venuePhone ?? "",
        r.stage, r.emailStatus ?? "", r.callStatus ?? "",
        r.depositAmount ?? "", r.bookedShowDate ?? "", r.bookedShowFee ?? "",
        r.nearestShowName ?? "", r.nearestShowDate ?? "", r.distanceMiles ?? "",
      ].map(escape).join(",")
    );
    const csv = [header.join(","), ...rowsCsv].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    if (activeStage === "ALL") return rows;
    return rows.filter((r) => r.stage === activeStage);
  }, [activeStage, rows]);

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
            <Button variant="default" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download size={13} />
              Export{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={launchCampaign}
              disabled={launching || rows.length === 0}
              title={selectedIds.size > 0 ? `Send to ${selectedIds.size} selected venue(s)` : "Send to all QUEUED venues with a contact email"}
            >
              {launching ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {launching
                ? "Launching…"
                : selectedIds.size > 0
                  ? `Launch (${selectedIds.size})`
                  : "Launch Campaign"}
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

      <BulkActions
        selectedIds={[...selectedIds]}
        onClear={() => setSelectedIds(new Set())}
        onSent={async () => {
          setSelectedIds(new Set());
          await refresh();
        }}
      />

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
