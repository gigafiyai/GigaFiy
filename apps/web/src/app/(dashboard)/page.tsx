"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { SendBudget } from "@/components/outreach/send-budget";
import { IncomeSummary } from "@/components/dashboard/income-summary";
import type { PipelineRow } from "@/lib/types";
import {
  MapPin,
  Mail,
  Phone,
  TrendingUp,
  Zap,
  Search,
  Loader2,
  Check,
  UserSearch,
  StopCircle,
} from "lucide-react";
import { EnrichModal, type EnrichTier } from "@/components/dashboard/enrich-modal";
import { EnrichRoadmap } from "@/components/dashboard/enrich-roadmap";
import { ShowOutreachRow } from "@/components/dashboard/show-outreach-row";

type Show = {
  id: string;
  date: string;
  dayOfWeek: string;
  city: string;
  state: string;
  venueName: string;
  showType: string;
  venuesDiscovered: number;
};

type DiscoveryResult = {
  inserted: number;
  updated: number;
  skipped: number;
  sourceCounts?: Record<string, number>;
  dedupedCandidates?: number;
};

export default function DashboardPage() {
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);
  const [radius, setRadius] = useState(25);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [results, setResults] = useState<Record<string, DiscoveryResult | { error: string }>>({});
  const [enriching, setEnriching] = useState(false);
  const [enrichingTier, setEnrichingTier] = useState<"free" | "deep" | "premium" | null>(null);
  const [enrichSummary, setEnrichSummary] = useState<string | null>(null);
  const [enrichResults, setEnrichResults] = useState<Record<string, { enriching?: boolean; enriched?: number; noMatch?: number; attempted?: number; error?: string }>>({});
  const [activeEnrichShowId, setActiveEnrichShowId] = useState<string | null>(null);
  const [enrichAbort, setEnrichAbort] = useState<AbortController | null>(null);
  const [showEnrichModal, setShowEnrichModal] = useState(false);

  const [artist, setArtist] = useState<{ videoReelUrl: string | null; instagramHandle: string | null; hometown: string | null } | null>(null);

  // Server-side job state (persists across page navigation)
  type JobStatus = {
    id: string; tier: string; status: string;
    attempted: number; enriched: number; noMatch: number;
    totalShows: number; showsDone: number;
    currentShow: string | null; errorMsg: string | null;
    completedAt: string | null;
  };
  const [activeJob, setActiveJob] = useState<JobStatus | null>(null);
  const [jobPolling, setJobPolling] = useState(false);

  async function refresh() {
    const [pipelineRes, showsRes] = await Promise.all([
      fetch("/api/pipeline").then((r) => r.json()),
      fetch("/api/shows").then((r) => r.json()),
    ]);
    setRows(pipelineRes);
    setShows(showsRes);
    setLoading(false);
  }

  // On mount: load data, artist profile, and check for running job.
  useEffect(() => {
    refresh();
    fetch("/api/artist").then((r) => r.json()).then((a) => setArtist(a)).catch(() => {});
    fetch("/api/enrichment/status")
      .then((r) => r.json())
      .then(({ job }) => {
        if (job && (job.status === "running")) {
          setActiveJob(job);
          setEnriching(true);
          setEnrichingTier(job.tier as "free" | "deep" | "premium");
          setJobPolling(true);
        } else if (job && job.status !== "running") {
          setActiveJob(job);
        }
      })
      .catch(() => {});
  }, []);

  // Poll job status every 4s while a job is running.
  useEffect(() => {
    if (!jobPolling) return;
    const interval = setInterval(async () => {
      try {
        const { job } = await fetch("/api/enrichment/status").then((r) => r.json());
        if (!job) { setJobPolling(false); return; }
        setActiveJob(job);

        // Map job progress onto per-show rows.
        const currentShowId = job.currentShow
          ? shows.find((s) => `${s.city}, ${s.state}` === job.currentShow)?.id ?? null
          : null;

        if (currentShowId) {
          setActiveEnrichShowId(currentShowId);
          setEnrichResults((prev) => {
            const next = { ...prev };
            // Mark previous shows as done (showsDone tells us how many completed).
            shows.forEach((s, idx) => {
              if (idx < job.showsDone && !next[s.id]?.attempted) {
                next[s.id] = { enriching: false, enriched: 0, noMatch: 0, attempted: 0 };
              }
            });
            // Mark current show as in-progress.
            next[currentShowId] = { enriching: true, enriched: 0, noMatch: 0, attempted: 0 };
            return next;
          });
        }

        if (job.status !== "running") {
          setJobPolling(false);
          setEnriching(false);
          setEnrichingTier(null);
          setActiveEnrichShowId(null);
          setEnrichSummary(
            job.status === "completed"
              ? `${job.tier} · ${job.enriched} enriched · ${job.noMatch} no match across ${job.attempted} venues`
              : job.status === "cancelled"
              ? `${job.tier} · stopped · ${job.enriched} enriched`
              : `${job.tier} · error: ${job.errorMsg ?? "unknown"}`
          );
          await refresh();
        } else {
          setEnrichSummary(
            `${job.tier} · ${job.enriched} enriched · ${job.noMatch} no match · show ${job.showsDone}/${job.totalShows}${job.currentShow ? ` (${job.currentShow})` : ""}`
          );
        }
      } catch {
        setJobPolling(false);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [jobPolling, shows]);

  async function discoverShow(showId: string) {
    setRunningId(showId);
    try {
      const res = await fetch("/api/discovery/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId, radiusMiles: radius }),
      });
      const data = await res.json();
      setResults((r) => ({ ...r, [showId]: res.ok ? data : { error: data.error } }));
    } catch (e) {
      setResults((r) => ({
        ...r,
        [showId]: { error: e instanceof Error ? e.message : "failed" },
      }));
    } finally {
      setRunningId(null);
      await refresh();
    }
  }

  async function discoverAll() {
    setRunningAll(true);
    for (const show of shows) {
      await discoverShow(show.id);
    }
    setRunningAll(false);
  }

  // Prune, Repair, Mine Reviews, Score, and Rebook now run automatically
  // as phases of the enrichment pipeline (see /api/enrichment/start).

  async function enrichAll(tier: "free" | "deep" | "premium") {
    setEnriching(true);
    setEnrichingTier(tier);
    setEnrichResults({});
    setEnrichSummary(`${tier} · starting server-side job…`);

    try {
      const res = await fetch(`/api/enrichment/start?tier=${tier}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setEnrichSummary(data.error ?? "Failed to start job");
        setEnriching(false);
        setEnrichingTier(null);
        return;
      }
      setActiveJob({ ...data, status: "running", attempted: 0, enriched: 0, noMatch: 0,
        skipped: 0, showsDone: 0, currentShow: null, errorMsg: null, completedAt: null,
        startedAt: new Date().toISOString() });
      setEnrichSummary(`${tier} · running server-side — navigate freely`);
      setJobPolling(true);
    } catch (e) {
      setEnrichSummary(e instanceof Error ? e.message : "Failed to start");
      setEnriching(false);
      setEnrichingTier(null);
    }
  }

  async function stopEnrichment() {
    await fetch("/api/enrichment/cancel", { method: "POST" });
    setJobPolling(false);
    setEnriching(false);
    setEnrichingTier(null);
    setActiveEnrichShowId(null);
    setEnrichSummary((s) => (s ? `${s} · stopping…` : "stopped"));
  }

  const stats = useMemo(
    () => ({
      total: rows.length,
      contacted: rows.filter((r) => r.stage !== "QUEUED").length,
      interested: rows.filter(
        (r) =>
          r.stage === "INTERESTED" || r.stage === "DEPOSIT" || r.stage === "BOOKED"
      ).length,
      booked: rows.filter((r) => r.stage === "BOOKED").length,
      revenue: rows
        .filter((r) => r.stage === "BOOKED")
        .reduce((s, r) => s + (r.bookedShowFee ?? 0), 0),
    }),
    [rows]
  );

  return (
    <>
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        description="Elijah Stone — Indie Folk"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {enrichSummary && (
              <span className="text-xs text-text-light max-w-md truncate" title={enrichSummary}>
                {enrichSummary}
              </span>
            )}
            {enriching ? (
              <Button
                variant="default"
                size="sm"
                onClick={() => void stopEnrichment()}
              >
                <StopCircle size={13} />
                Stop enrichment
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowEnrichModal(true)}
                disabled={stats.total === 0}
              >
                <UserSearch size={13} />
                Enrich
              </Button>
            )}
          </div>
        }
      />

      <div className="p-6 space-y-6 overflow-y-auto">
        {/* Income & forecast — earned, booked, weighted pipeline */}
        <IncomeSummary />

        {/* Daily send budget — paced cold-email cap + send-next-N */}
        <SendBudget />

        {/* Enrichment pipeline status + roadmap */}
        {activeJob && (
          <div className="border border-border rounded-lg px-4 py-4 bg-background">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {activeJob.status === "running"
                  ? <Loader2 size={13} className="animate-spin text-accent-blue" />
                  : <Check size={13} className="text-success-green" />}
                <p className="text-sm font-medium text-text">
                  {activeJob.status === "running"
                    ? `Enrichment pipeline — ${activeJob.tier} tier`
                    : `Pipeline complete · ${activeJob.enriched} emails found`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {activeJob.status === "running" && (
                  <p className="text-xs text-accent-blue">Navigate freely</p>
                )}
                <button type="button" onClick={() => setActiveJob(null)} className="text-xs text-text-light hover:text-text">Dismiss</button>
              </div>
            </div>
            <EnrichRoadmap
              currentPhase={(activeJob as any).phase ?? "enrich"}
              status={activeJob.status as "running" | "completed" | "cancelled" | "error"}
              pruned={(activeJob as any).pruned}
              repaired={(activeJob as any).repaired}
              enriched={activeJob.enriched}
              reviewsMined={(activeJob as any).reviewsMined}
              showsDone={activeJob.showsDone}
              totalShows={activeJob.totalShows}
              currentShow={activeJob.currentShow}
            />
          </div>
        )}

        {/* Settings completion nudge */}
        {artist && (!artist.videoReelUrl || !artist.instagramHandle || !artist.hometown) && (
          <div className="border border-amber/30 bg-amber-bg rounded-lg px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-text">Complete your profile before launching</p>
              <p className="text-xs text-text-light mt-0.5">
                Missing:{" "}
                {[
                  !artist.videoReelUrl && "reel URL",
                  !artist.instagramHandle && "Instagram handle",
                  !artist.hometown && "hometown",
                ].filter(Boolean).join(" · ")}
                {" "}— every email gets better when these are filled in.
              </p>
            </div>
            <a href="/settings" className="text-xs text-accent-blue hover:underline shrink-0 ml-4">
              Fix in Settings →
            </a>
          </div>
        )}

        <div className="border border-border rounded-lg p-5 bg-background">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-accent-blue-bg border border-accent-blue/20 flex items-center justify-center text-accent-blue text-lg font-semibold">
                E
              </div>
              <div>
                <h2 className="text-base font-semibold text-text">Elijah Stone</h2>
                <p className="text-sm text-text-medium">
                  Indie Folk · Northeast tour
                </p>
                <p className="text-xs text-text-light mt-1">
                  {shows.length} confirmed shows · Jun–Aug 2026
                </p>
              </div>
            </div>
            <span className="px-2 py-1 rounded text-xs bg-success-green-bg text-success-green border border-success-green/20 font-medium">
              Pilot artist
            </span>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {[
            { label: "Venues targeted", value: stats.total, icon: MapPin },
            { label: "Contacted", value: stats.contacted, icon: Mail },
            { label: "Interested", value: stats.interested, icon: TrendingUp },
            { label: "Booked", value: stats.booked, icon: Phone },
            {
              label: "Revenue",
              value: `$${stats.revenue.toLocaleString()}`,
              icon: TrendingUp,
              green: true,
            },
          ].map(({ label, value, icon: Icon, green }) => (
            <div
              key={label}
              className="border border-border rounded-lg p-4 bg-background"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Icon size={13} className="text-text-light" />
                <span className="text-xs text-text-light">{label}</span>
              </div>
              <p
                className={`text-2xl font-semibold ${green ? "text-success-green" : "text-text"}`}
              >
                {value}
              </p>
            </div>
          ))}
        </div>

        <div className="border border-border rounded-lg bg-background overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div>
              <h3 className="text-sm font-medium text-text">Discovery</h3>
              <p className="text-xs text-text-light mt-0.5">
                Find venues near each show via Google Places. Queues them for outreach.
              </p>
              {activeEnrichShowId && (
                <p className="text-xs text-accent-blue mt-1 flex items-center gap-1.5">
                  <Loader2 size={11} className="animate-spin" />
                  Working on:{" "}
                  {(() => {
                    const s = shows.find((x) => x.id === activeEnrichShowId);
                    return s ? `${s.city}, ${s.state} — ${s.venueName}` : "—";
                  })()}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <Button variant="primary" size="sm" onClick={discoverAll} disabled={runningAll || shows.length === 0}>
                {runningAll ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
                {runningAll ? "Running…" : "Discover all shows"}
              </Button>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-light">Radius</span>
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                  className="text-xs h-7 px-2 rounded border border-border bg-white"
                >
                  <option value={10}>10 mi</option>
                  <option value={15}>15 mi</option>
                  <option value={20}>20 mi</option>
                  <option value={25}>25 mi</option>
                  <option value={31}>31 mi (max)</option>
                </select>
              </div>
            </div>
          </div>
          {loading ? (
            <div className="px-4 py-8 text-sm text-text-light">Loading shows…</div>
          ) : shows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-text-light">No shows seeded.</div>
          ) : (
            <div className="divide-y divide-border">
              {shows.map((s) => (
                <ShowOutreachRow
                  key={s.id}
                  show={s}
                  discoverResult={results[s.id]}
                  enrichRow={enrichResults[s.id]}
                  isDiscovering={runningId === s.id}
                  disabled={runningAll}
                  onDiscover={() => discoverShow(s.id)}
                  onChanged={refresh}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

      {showEnrichModal && (
        <EnrichModal
          artistPlan="starter"
          onSelect={(tier: EnrichTier) => {
            setShowEnrichModal(false);
            void enrichAll(tier);
          }}
          onClose={() => setShowEnrichModal(false)}
        />
      )}
    </>
  );
}
