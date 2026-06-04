import { NextRequest, NextResponse } from "next/server";
import { assembleVenueBrief } from "@/lib/assemble-brief";

export const dynamic = "force-dynamic";

// Preview the full Tulio agent brief for a single venue: persona + everything
// Gigify knows about the artist, this venue, the nearby show, pricing, and the
// offer. Returns a ready-to-use system prompt + opener for a voice agent, plus
// a structured knowledge preview for the UI.
//   GET /api/calls/brief?venueId=...
export async function GET(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("venueId");
  if (!venueId) {
    return NextResponse.json({ error: "venueId required" }, { status: 400 });
  }

  const assembled = await assembleVenueBrief(venueId);
  if (!assembled) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  return NextResponse.json({
    ok: true,
    venue: assembled.venue,
    pricing: assembled.pricing,
    brief: assembled.brief,
  });
}
