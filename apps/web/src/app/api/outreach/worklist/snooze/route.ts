import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

// Worklist housekeeping. The artist can push a lead to later (snooze) or remove
// it from the worklist entirely (dismiss) without unsubscribing the venue.
//   POST { venueId, action: "snooze", days }   → snoozedUntil = now + days
//   POST { venueId, action: "dismiss" }         → worklistDismissedAt = now
//   POST { venueId, action: "restore" }         → clear both
export async function POST(req: NextRequest) {
  const { venueId, action, days } = (await req.json()) as {
    venueId?: string;
    action?: "snooze" | "dismiss" | "restore";
    days?: number;
  };
  if (!venueId || !action) return NextResponse.json({ error: "venueId and action required" }, { status: 400 });

  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const venue = await prisma.venue.findFirst({ where: { id: venueId, artistId: artist.id }, select: { id: true } });
  if (!venue) return NextResponse.json({ error: "venue not found" }, { status: 404 });

  const data: { snoozedUntil?: Date | null; worklistDismissedAt?: Date | null } = {};
  if (action === "snooze") {
    const d = Math.min(Math.max(Math.round(days ?? 7), 1), 365);
    data.snoozedUntil = new Date(Date.now() + d * 86_400_000);
  } else if (action === "dismiss") {
    data.worklistDismissedAt = new Date();
  } else {
    data.snoozedUntil = null;
    data.worklistDismissedAt = null;
  }

  await prisma.venue.update({ where: { id: venue.id }, data });
  return NextResponse.json({ ok: true });
}
