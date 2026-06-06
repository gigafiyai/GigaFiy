"use client";

import { useEffect, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker, Line, ZoomableGroup } from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

type Show = { id: string; venueName: string; city: string; state: string; date: string; lng: number; lat: number; status: string };
type Venue = { id: string; name: string; city: string; state: string; lng: number; lat: number; leadTier: string | null; stage: string | null };

const TIER_FILL: Record<string, string> = {
  A: "#38bdf8", // sky
  B: "#818cf8", // indigo
  C: "#a78bfa", // violet
  D: "#52525b", // zinc
};

const isWon = (stage: string | null) => stage === "DEPOSIT" || stage === "BOOKED";

export function TourMapCanvas() {
  const [shows, setShows] = useState<Show[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);
  // Track zoom so markers can be counter-scaled to a constant on-screen size.
  const [pos, setPos] = useState<{ coordinates: [number, number]; zoom: number }>({ coordinates: [-73, 42], zoom: 2.4 });

  useEffect(() => {
    fetch("/api/tour-map").then((r) => r.json()).then((d) => {
      if (d?.ok) { setShows(d.shows); setVenues(d.venues); }
    });
  }, []);

  const k = 1 / pos.zoom; // counter-scale factor — keeps markers a fixed screen size

  return (
    <div className="relative w-full h-full bg-[#0b0b12]">
      <ComposableMap projection="geoAlbersUsa" width={980} height={560} style={{ width: "100%", height: "100%" }}>
        <ZoomableGroup
          center={pos.coordinates}
          zoom={pos.zoom}
          minZoom={1}
          maxZoom={16}
          onMoveEnd={(p) => setPos(p as { coordinates: [number, number]; zoom: number })}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#14141d"
                  stroke="#262637"
                  strokeWidth={0.4 * k}
                  style={{ default: { outline: "none" }, hover: { outline: "none", fill: "#1a1a27" }, pressed: { outline: "none" } }}
                />
              ))
            }
          </Geographies>

          {/* Routing lines between consecutive shows */}
          {shows.slice(0, -1).map((s, i) => (
            <Line
              key={`line-${s.id}`}
              from={[s.lng, s.lat]}
              to={[shows[i + 1].lng, shows[i + 1].lat]}
              stroke="rgba(96,165,250,0.4)"
              strokeWidth={0.9 * k}
              strokeLinecap="round"
            />
          ))}

          {/* Venue leads — small dots, tier-colored; won deals glow green */}
          {venues.map((v) => {
            const won = isWon(v.stage);
            return (
              <Marker
                key={v.id}
                coordinates={[v.lng, v.lat]}
                onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, label: `${v.name} · ${v.city}, ${v.state}${v.leadTier ? ` · ${v.leadTier}` : ""}` })}
                onMouseLeave={() => setHover(null)}
              >
                {won ? (
                  <circle r={3.2 * k} fill="#22c55e" stroke="#bbf7d0" strokeWidth={0.5 * k} style={{ filter: `drop-shadow(0 0 ${3 * k}px #22c55e)` }} />
                ) : (
                  <circle r={1.9 * k} fill={TIER_FILL[v.leadTier ?? "D"] ?? "#52525b"} fillOpacity={0.95} />
                )}
              </Marker>
            );
          })}

          {/* Confirmed shows — the routing anchors (kept small + constant size) */}
          {shows.map((s) => (
            <Marker
              key={s.id}
              coordinates={[s.lng, s.lat]}
              onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, label: `🎤 ${s.venueName} · ${s.city}, ${s.state} · ${s.date}` })}
              onMouseLeave={() => setHover(null)}
            >
              <circle r={4.5 * k} fill="#f8fafc" stroke="#60a5fa" strokeWidth={1.4 * k} style={{ filter: `drop-shadow(0 0 ${2.5 * k}px rgba(96,165,250,0.9))` }} />
              <circle r={1.7 * k} fill="#60a5fa" />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>

      {/* Hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 px-2 py-1 rounded bg-black/85 text-white text-xs whitespace-nowrap"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          {hover.label}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-1">
        {[["+", 1.5], ["−", 1 / 1.5]].map(([label, factor]) => (
          <button
            key={label as string}
            type="button"
            onClick={() => setPos((p) => ({ ...p, zoom: Math.min(16, Math.max(1, p.zoom * (factor as number))) }))}
            className="w-7 h-7 rounded bg-black/60 border border-white/15 text-white/80 hover:bg-black/80 text-sm leading-none"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
