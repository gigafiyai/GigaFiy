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
  D: "#3f3f46", // zinc
};

const isWon = (stage: string | null) => stage === "DEPOSIT" || stage === "BOOKED";

export function TourMapCanvas() {
  const [shows, setShows] = useState<Show[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number; label: string } | null>(null);

  useEffect(() => {
    fetch("/api/tour-map").then((r) => r.json()).then((d) => {
      if (d?.ok) { setShows(d.shows); setVenues(d.venues); }
    });
  }, []);

  return (
    <div className="relative w-full h-full bg-[#0b0b12]">
      <ComposableMap projection="geoAlbersUsa" width={980} height={560} style={{ width: "100%", height: "100%" }}>
        <ZoomableGroup center={[-73, 42]} zoom={3.2} minZoom={1} maxZoom={12}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#15151f"
                  stroke="#26263a"
                  strokeWidth={0.5}
                  style={{ default: { outline: "none" }, hover: { outline: "none", fill: "#1b1b29" }, pressed: { outline: "none" } }}
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
              stroke="rgba(96,165,250,0.35)"
              strokeWidth={1}
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
                  <circle r={4} fill="#22c55e" stroke="#bbf7d0" strokeWidth={0.6} style={{ filter: "drop-shadow(0 0 4px #22c55e)" }} />
                ) : (
                  <circle r={2.3} fill={TIER_FILL[v.leadTier ?? "D"] ?? "#3f3f46"} fillOpacity={0.9} />
                )}
              </Marker>
            );
          })}

          {/* Confirmed shows — the routing anchors */}
          {shows.map((s) => (
            <Marker
              key={s.id}
              coordinates={[s.lng, s.lat]}
              onMouseEnter={(e) => setHover({ x: e.clientX, y: e.clientY, label: `🎤 ${s.venueName} · ${s.city}, ${s.state} · ${s.date}` })}
              onMouseLeave={() => setHover(null)}
            >
              <circle r={6} fill="#fafafa" stroke="#60a5fa" strokeWidth={1.5} style={{ filter: "drop-shadow(0 0 5px rgba(96,165,250,0.8))" }} />
              <circle r={2} fill="#60a5fa" />
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
    </div>
  );
}
