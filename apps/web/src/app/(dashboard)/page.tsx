"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import type { PipelineRow } from "@/lib/types";
import {
  MapPin,
  Mail,
  Phone,
  TrendingUp,
  Zap,
  Search,
  Loader2,
  AlertCircle,
  Check,
  UserSearch,
  Wrench,
  Trash2,
  StopCircle,
  Star,
  RefreshCw,
  MessageSquare,
} from "lucide-react";

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
  const [maintaining, setMaintaining] = useState<null | "repair" | "prune" | "score" | "rebook" | "reviews">(null);
  const [maintenanceSummary, setMaintenanceSummary] = useState<string | null>(null);
  const [prunedNames, setPrunedNames] = useState<string[] | null>(null);

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

  async function mineReviews() {
    setMaintaining("reviews");
    setMaintenanceSummary(null);
    setEnrichSummary(null);
    try {
      const res = await fetch("/api/venues/mine-reviews", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMaintenanceSummary(
          `Reviews mined: ${data.liveMusicFound} live music venues found · ${data.privateEventsFound} private-event friendly · ${data.remaining} remaining`
        );
      } else setMaintenanceSummary(data.error);
    } catch (e) {
      setMaintenanceSummary(e instanceof Error ? e.message : "Failed");
    } finally {
      setMaintaining(null);
    }
  }

  async function scoreVenues() {
    setMaintaining("score");
    setMaintenanceSummary(null);
    setEnrichSummary(null);
    try {
      const res = await fetch("/api/venues/score", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        const tiers = (data.tiers as Array<{ leadTier: string; _count: number }>)
          .map((t) => `${t.leadTier}: ${t._count}`).join(" · ");
        setMaintenanceSummary(`Scored ${data.scored} venues — ${tiers}`);
      } else setMaintenanceSummary(data.error);
    } catch (e) {
      setMaintenanceSummary(e instanceof Error ? e.message : "Score failed");
    } finally {
      setMaintaining(null);
    }
  }

  async function triggerRebook() {
    setMaintaining("rebook");
    setMaintenanceSummary(null);
    try {
      const res = await fetch("/api/pipeline/rebooking", { method: "POST" });
      const data = await res.json();
      if (res.ok) setMaintenanceSummary(`Rebook flywheel: ${data.rebookedVenues} venues queued for follow-up`);
      else setMaintenanceSummary(data.error);
      await refresh();
    } catch (e) {
      setMaintenanceSummary(e instanceof Error ? e.message : "Rebook failed");
    } finally {
      setMaintaining(null);
    }
  }

  async function repair() {
    setMaintaining("repair");
    setMaintenanceSummary(null);
    setEnrichSummary(null);
    try {
      const res = await fetch("/api/venues/repair", { method: "POST" });
      const data = await res.json();
      setMaintenanceSummary(
        res.ok
          ? `Repaired ${data.cityFixed} cities · ${data.stateFixed} states · ${data.typeFixed} types · cleared ${data.emailsCleared} junk emails (${data.venuesScanned} scanned)`
          : data.error
      );
      await refresh();
    } catch (e) {
      setMaintenanceSummary(e instanceof Error ? e.message : "Repair failed");
    } finally {
      setMaintaining(null);
    }
  }

  async function prune() {
    setMaintaining("prune");
    setMaintenanceSummary(null);
    setEnrichSummary(null);
    setPrunedNames(null);
    try {
      const res = await fetch("/api/venues/prune", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMaintenanceSummary(`Pruned ${data.removed} blocklisted venues`);
        setPrunedNames(data.names ?? []);
      } else {
        setMaintenanceSummary(data.error);
      }
      await refresh();
    } catch (e) {
      setMaintenanceSummary(e instanceof Error ? e.message : "Prune failed");
    } finally {
      setMaintaining(null);
    }
  }

  async function enrichAll(tier: "free" | "deep" | "premium") {
    setEnriching(true);
    setEnrichingTier(tier);
    setMaintenanceSummary(null);
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
    <div className="flex flex-col h-full">
      <Header
        title="Dashboard"
        description="Elijah Stone — Indie Folk"
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {(enrichSummary || maintenanceSummary) && (
              <span
                className="text-xs text-text-light max-w-md truncate"
                title={enrichSummary ?? maintenanceSummary ?? ""}
              >
                {/* Whichever was set most recently wins — we clear the other on action start. */}
                {enrichSummary ?? maintenanceSummary}
              </span>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={mineReviews}
              disabled={maintaining !== null || stats.total === 0}
              title="Mine Google Places reviews for live music mentions — uses existing Places key"
            >
              {maintaining === "reviews" ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
              Mine reviews
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={scoreVenues}
              disabled={maintaining !== null || stats.total === 0}
              title="Score all venues by likelihood to book (A–D tier). Run after enrichment."
            >
              {maintaining === "score" ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
              Score
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={triggerRebook}
              disabled={maintaining !== null}
              title="Queue follow-up outreach for venues booked 90+ days ago"
            >
              {maintaining === "rebook" ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Rebook
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={prune}
              disabled={maintaining !== null || stats.total === 0}
              title="Delete venues matching the blocklist (chains, fast food, casinos)"
            >
              {maintaining === "prune" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Prune
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={repair}
              disabled={maintaining !== null || stats.total === 0}
              title="Re-parse city/state from address, fix venue types based on name"
            >
              {maintaining === "repair" ? <Loader2 size={13} className="animate-spin" /> : <Wrench size={13} />}
              Repair
            </Button>
            {enriching && (
              <Button
                variant="default"
                size="sm"
                onClick={() => void stopEnrichment()}
                title="Stop enrichment after the current batch"
              >
                <StopCircle size={13} />
                Stop
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              onClick={() => enrichAll("free")}
              disabled={enriching || stats.total === 0}
              title="Scrape booking@ / events@ from each venue's website. Free, no per-lookup cost."
            >
              {enrichingTier === "free" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UserSearch size={13} />
              )}
              Enrich (free)
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => enrichAll("deep")}
              disabled={enriching || stats.total === 0}
              title="Headless browser — executes JS to extract mailto: links the fast scraper misses. ~5-15s per venue. Free."
            >
              {enrichingTier === "deep" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UserSearch size={13} />
              )}
              Enrich (deep)
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => enrichAll("premium")}
              disabled={enriching || stats.total === 0}
              title="Booking-Agent.io — named talent buyer. Paid per lookup."
            >
              {enrichingTier === "premium" ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <UserSearch size={13} />
              )}
              Enrich (premium)
            </Button>
            <Button variant="primary" size="sm" onClick={discoverAll} disabled={runningAll || shows.length === 0}>
              {runningAll ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
              {runningAll ? "Running…" : "Discover all shows"}
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6 overflow-y-auto">
        {/* Persistent job status — visible even after returning from another tab */}
        {activeJob && activeJob.status === "running" && (
          <div className="border border-accent-blue/20 bg-accent-blue-bg rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Loader2 size={14} className="animate-spin text-accent-blue" />
              <div>
                <p className="text-sm font-medium text-text">
                  Enrichment running in background — {activeJob.tier} tier
                </p>
                <p className="text-xs text-text-light mt-0.5">
                  Show {activeJob.showsDone}/{activeJob.totalShows}
                  {activeJob.currentShow && ` · ${activeJob.currentShow}`}
                  {" · "}{activeJob.enriched} enriched so far
                </p>
              </div>
            </div>
            <p className="text-xs text-accent-blue">Navigate freely — this runs on the server</p>
          </div>
        )}
        {activeJob && activeJob.status === "completed" && !enriching && (
          <div className="border border-success-green/20 bg-success-green-bg rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check size={14} className="text-success-green" />
              <p className="text-sm font-medium text-text">
                Enrichment complete · {activeJob.enriched} new emails found across {activeJob.attempted} venues
              </p>
            </div>
            <button type="button" onClick={() => setActiveJob(null)} className="text-xs text-text-light hover:text-text">Dismiss</button>
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

        {prunedNames && prunedNames.length > 0 && (
          <div className="border border-amber/30 bg-amber-bg rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-amber">
                Pruned {prunedNames.length} venue{prunedNames.length === 1 ? "" : "s"} from the blocklist
              </p>
              <button
                type="button"
                onClick={() => setPrunedNames(null)}
                className="text-xs text-amber hover:opacity-70"
              >
                Dismiss
              </button>
            </div>
            <div className="text-xs text-text-medium max-h-48 overflow-y-auto">
              {prunedNames.map((n, i) => (
                <span key={i}>
                  {n}
                  {i < prunedNames.length - 1 && " · "}
                </span>
              ))}
            </div>
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
            <div className="flex items-center gap-2">
              <label className="text-xs text-text-light">Radius</label>
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
          {loading ? (
            <div className="px-4 py-8 text-sm text-text-light">Loading shows…</div>
          ) : shows.length === 0 ? (
            <div className="px-4 py-8 text-sm text-text-light">No shows seeded.</div>
          ) : (
            <div className="divide-y divide-border">
              {shows.map((s) => {
                const result = results[s.id];
                const enrichRow = enrichResults[s.id];
                const isRunning = runningId === s.id;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-surface transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 text-center shrink-0">
                        <p className="text-xs text-text-light uppercase">{s.dayOfWeek.slice(0, 3)}</p>
                        <p className="text-sm font-medium text-text">
                          {new Date(s.date + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-text font-medium truncate">
                          {s.city}, {s.state}
                        </p>
                        <p className="text-xs text-text-light truncate">{s.venueName}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-text-light">
                        {s.venuesDiscovered} venue{s.venuesDiscovered === 1 ? "" : "s"}
                      </span>
                      {enrichRow?.enriching && (
                        <span className="flex items-center gap-1 text-xs text-accent-blue">
                          <Loader2 size={11} className="animate-spin" />
                          enriching… {enrichRow.enriched ?? 0} found
                        </span>
                      )}
                      {enrichRow && !enrichRow.enriching && enrichRow.error && (
                        <span className="flex items-center gap-1 text-xs text-amber">
                          <AlertCircle size={12} />
                          {enrichRow.error}
                        </span>
                      )}
                      {enrichRow && !enrichRow.enriching && !enrichRow.error && enrichRow.attempted !== undefined && (
                        <span className="flex items-center gap-1 text-xs text-success-green">
                          <Check size={12} />
                          {enrichRow.enriched ?? 0}/{enrichRow.attempted} enriched
                        </span>
                      )}
                      {result && "error" in result && (
                        <span className="flex items-center gap-1 text-xs text-amber max-w-[200px] truncate">
                          <AlertCircle size={12} />
                          {result.error}
                        </span>
                      )}
                      {result && !("error" in result) && (
                        <span
                          className="flex items-center gap-1 text-xs text-success-green"
                          title={
                            result.sourceCounts
                              ? `Sources: ${Object.entries(result.sourceCounts).map(([s, n]) => `${s.replace(/_/g, " ")} ${n}`).join(" · ")} → ${result.dedupedCandidates ?? "?"} unique`
                              : undefined
                          }
                        >
                          <Check size={12} />
                          +{result.inserted} new
                          {result.updated > 0 ? `, ${result.updated} re-anchored` : ""}
                          {result.sourceCounts ? (
                            <span className="text-text-light ml-1">
                              ({Object.values(result.sourceCounts).reduce((a, b) => a + b, 0)} ✕ src → {result.dedupedCandidates ?? "?"} unique)
                            </span>
                          ) : null}
                        </span>
                      )}
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => discoverShow(s.id)}
                        disabled={isRunning || runningAll}
                      >
                        {isRunning ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Search size={13} />
                        )}
                        Discover
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
