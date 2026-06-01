import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Returns a CSV of the full pipeline — all venues, contacts, stages, show info.
// Used by the Export button and as a backup for manual outreach.
export async function GET(req: NextRequest) {
  const stage = req.nextUrl.searchParams.get("stage");

  const pipelines = await prisma.pipeline.findMany({
    where: stage ? { stage: stage as any } : undefined,
    include: {
      venue: { include: { nearestShow: true } },
      artist: true,
    },
    orderBy: [
      { venue: { nearestShow: { date: "asc" } } },
      { venue: { distanceMiles: "asc" } },
    ],
  });

  const headers = [
    "Venue", "City", "State", "Type",
    "Decision Maker", "Role", "Email", "Phone",
    "Stage", "Email Status", "Call Status",
    "Deposit ($)", "Booked Show Date", "Total Fee ($)",
    "Nearest Show", "Show Date", "Distance (mi)",
    "Hosts Live Music", "Genres", "Vibe", "Narrative",
    "Instagram",
  ];

  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = pipelines.map((p) => {
    const v = p.venue;
    return [
      v.name,
      v.city,
      v.state,
      v.venueType,
      v.decisionMakerName ?? "",
      v.decisionMakerRole ?? "",
      v.decisionMakerEmail ?? v.email ?? "",
      v.decisionMakerPhone ?? v.phone ?? "",
      p.stage,
      "", // email status pulled from outreach separately if needed
      p.callStatus ?? "",
      p.depositAmount ?? "",
      p.bookedShowDate?.toISOString().slice(0, 10) ?? "",
      p.bookedShowFee ?? "",
      v.nearestShow?.venueName ?? "",
      v.nearestShow?.date.toISOString().slice(0, 10) ?? "",
      v.distanceMiles ?? "",
      v.hostsLiveMusic === true ? "yes" : v.hostsLiveMusic === false ? "no" : "",
      (v.genresHosted ?? []).join("; "),
      (v.vibe ?? []).join("; "),
      v.narrative ?? "",
      v.instagramHandle ?? "",
    ].map(escape).join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");
  const filename = `gigify-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
