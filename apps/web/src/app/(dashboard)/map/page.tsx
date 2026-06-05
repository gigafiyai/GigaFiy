"use client";

import dynamic from "next/dynamic";
import { Header } from "@/components/layout/header";

// react-simple-maps fetches topojson client-side — render it client-only.
const TourMapCanvas = dynamic(
  () => import("@/components/map/tour-map-canvas").then((m) => m.TourMapCanvas),
  { ssr: false, loading: () => <div className="flex-1 grid place-items-center text-sm text-text-light bg-[#0b0b12]">Loading map…</div> }
);

const LEGEND: { label: string; color: string; ring?: boolean }[] = [
  { label: "Confirmed show", color: "#fafafa", ring: true },
  { label: "Booked / deposit", color: "#22c55e" },
  { label: "A-tier lead", color: "#38bdf8" },
  { label: "B-tier", color: "#818cf8" },
  { label: "C-tier", color: "#a78bfa" },
];

export default function TourMapPage() {
  return (
    <div className="flex flex-col h-full">
      <Header title="Tour Map" description="Elijah's routing, the leads clustered around each gig, and deals as they land" />
      <div className="relative flex-1 overflow-hidden">
        <TourMapCanvas />
        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur rounded-lg px-3 py-2.5 border border-white/10">
          <div className="space-y-1.5">
            {LEGEND.map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-[11px] text-white/85">
                <span
                  className="inline-block rounded-full"
                  style={{
                    width: 9, height: 9, background: l.color,
                    boxShadow: l.color === "#22c55e" ? "0 0 5px #22c55e" : l.ring ? "0 0 5px rgba(96,165,250,0.8)" : "none",
                    border: l.ring ? "1.5px solid #60a5fa" : "none",
                  }}
                />
                {l.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
