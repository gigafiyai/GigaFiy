"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, CalendarPlus, X, ArrowRight, Check, Copy } from "lucide-react";
import { Avatar } from "@/components/marketing/avatar";

type Act = {
  id: string; name: string; slug: string; genre: string; hometown: string | null;
  hourlyRate: number | null; photoUrl: string | null; soundsLike: string | null; showsPlayed: number;
  nearestMiles: number | null;
};
type ActSearch = { acts: Act[]; located: boolean; radiusMiles: number | null; hiddenFarAway: number };
export type NightRow = { id: string; date: string; budget: number | null; notes: string | null; status: string };

const field = "px-3 py-2.5 text-sm bg-elevated border border-border rounded-lg text-text focus:outline-none focus:border-accent-blue placeholder:text-text-light";

function pretty(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

// Remembers this workspace on the device and offers the link to save.
export function SaveLinkNotice({ token, isNew }: { token: string; isNew: boolean }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    try { localStorage.setItem("gigify-venue-token", token); } catch { /* ignore */ }
    setUrl(`${window.location.origin}/venue/${token}`);
  }, [token]);
  if (!isNew) return null;
  return (
    <div className="border border-accent-blue/30 bg-accent-blue-bg rounded-xl p-4">
      <p className="text-sm font-medium text-text">Your venue page is ready. Save this link — it&apos;s how you get back in.</p>
      <div className="mt-2 flex items-center gap-2 border border-border rounded-lg bg-background px-3 py-2">
        <code className="text-xs text-text-medium truncate flex-1">{url}</code>
        <button
          type="button"
          onClick={async () => { await navigator.clipboard.writeText(url).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="text-xs text-text flex items-center gap-1 shrink-0 hover:text-accent-blue"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-text-light mt-2">Anyone with this link can manage this page, so share it only with people who book for you.</p>
    </div>
  );
}

// Pick a date → acts with nothing on their calendar that day.
export function FindActs({ token, minDate }: { token: string; minDate: string }) {
  const [date, setDate] = useState("");
  const [result, setResult] = useState<ActSearch | null>(null);
  const acts = result?.acts ?? null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(all: boolean) {
    if (!date) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/venue/${token}/acts?date=${date}${all ? "&all=1" : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed.");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
      setResult(null);
    } finally {
      setBusy(false);
    }
  }
  function search(e: React.FormEvent) {
    e.preventDefault();
    run(false);
  }

  return (
    <div>
      <form onSubmit={search} className="flex flex-col sm:flex-row gap-2">
        <input type="date" required min={minDate} value={date} onChange={(e) => { setDate(e.target.value); setResult(null); }} aria-label="Date" className={`${field} sm:w-56`} />
        <button type="submit" disabled={busy || !date} className="px-5 py-2.5 rounded-lg bg-accent-blue text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} See who&apos;s free
        </button>
      </form>
      {error && <p className="text-xs text-amber mt-2">{error}</p>}
      {acts && (
        <div className="mt-4">
          <p className="text-sm text-text-medium mb-2">
            {acts.length === 0
              ? `No acts ${result?.radiusMiles ? `within ${result.radiusMiles} miles ` : ""}are free on ${pretty(date)} yet.`
              : `${acts.length} ${acts.length === 1 ? "act is" : "acts are"} free on ${pretty(date)}${result?.radiusMiles ? `, within ${result.radiusMiles} miles` : ""}`}
          </p>
          {result && !result.located && (
            <p className="text-xs text-text-light mb-2">We couldn&apos;t place your town on the map, so this shows every act regardless of distance.</p>
          )}
          {result && result.hiddenFarAway > 0 && (
            <p className="text-xs text-text-light mb-2">
              {result.hiddenFarAway} more {result.hiddenFarAway === 1 ? "act is" : "acts are"} free but usually {result.hiddenFarAway === 1 ? "plays" : "play"} further away.{" "}
              <button type="button" onClick={() => run(true)} className="text-accent-blue hover:underline">Show them too</button>
            </p>
          )}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {acts.map((a) => (
              <li key={a.id}>
                <a href={`/${a.slug}?date=${date}&v=${token}`} className="block border border-border rounded-xl bg-background p-4 hover:border-border-medium h-full">
                  <div className="flex items-center gap-3">
                    <Avatar name={a.name} photoUrl={a.photoUrl} size={44} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text truncate">{a.name}</p>
                      <p className="text-xs text-text-light truncate">{a.genre}{a.hometown ? ` · ${a.hometown}` : ""}</p>
                    </div>
                  </div>
                  {a.soundsLike && <p className="text-xs text-text-medium mt-3 line-clamp-2">Sounds like {a.soundsLike}</p>}
                  {a.nearestMiles != null && (
                    <p className="text-xs text-text-light mt-2">
                      {a.nearestMiles <= 1 ? "Has played in your town" : `Has played ${a.nearestMiles} miles from you`}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-text-medium">
                      {a.hourlyRate ? `From $${Math.round(a.hourlyRate)}/hr` : "Rate on request"}
                      {a.showsPlayed > 0 ? ` · ${a.showsPlayed} shows played` : ""}
                    </span>
                    <span className="text-accent-blue flex items-center gap-1">Hold this date <ArrowRight size={12} /></span>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Nights the venue wants filled. Acts on Gigify can see these.
export function OpenNights({ token, minDate, nights }: { token: string; minDate: string; nights: NightRow[] }) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/venue/${token}/open-nights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, budget: budget ? Number(budget) : null, notes: notes || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't post that night.");
      setDate(""); setBudget(""); setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that night.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    await fetch(`/api/venue/${token}/open-nights?id=${id}`, { method: "DELETE" }).catch(() => {});
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[auto_8rem_1fr_auto] gap-2">
        <input type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={field} />
        <input type="number" min={0} value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget $" aria-label="Budget in dollars" className={field} />
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything acts should know (optional)" aria-label="Notes" maxLength={500} className={field} />
        <button type="submit" disabled={busy || !date} className="px-4 py-2.5 rounded-lg border border-border bg-background text-sm font-medium text-text hover:bg-surface-hover disabled:opacity-50 flex items-center justify-center gap-2">
          <CalendarPlus size={14} /> Post night
        </button>
      </form>
      {error && <p className="text-xs text-amber mt-2">{error}</p>}
      {nights.length > 0 && (
        <ul className="mt-4 border border-border rounded-xl bg-background divide-y divide-border">
          {nights.map((n) => (
            <li key={n.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text">{pretty(n.date)}</p>
                <p className="text-xs text-text-light truncate">
                  {n.budget != null ? `Budget $${Math.round(n.budget)}` : "No budget set"}
                  {n.notes ? ` · ${n.notes}` : ""}
                </p>
              </div>
              <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0 ${n.status === "filled" ? "text-success-green bg-success-green-bg border-success-green/20" : "text-accent-blue bg-accent-blue-bg border-accent-blue/20"}`}>
                {n.status === "filled" ? "Filled" : "Open"}
              </span>
              <button type="button" title="Remove" disabled={busy} onClick={() => remove(n.id)} className="text-text-light hover:text-text p-1 shrink-0">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
