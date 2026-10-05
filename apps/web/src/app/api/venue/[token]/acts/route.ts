import { NextRequest, NextResponse } from "next/server";
import { venueAccountByToken, parseDay, actsFreeOn, ensureVenueLocation, withinReach } from "@/lib/venue-accounts";
import { startOfToday } from "@/lib/today";

export const dynamic = "force-dynamic";

const DEFAULT_RADIUS_MILES = 100;

// GET ?date=YYYY-MM-DD[&all=1] → acts with nothing on their calendar that day.
// By default only acts that play within 100 miles of the venue; all=1 lifts that.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const account = await venueAccountByToken(params.token);
  if (!account) return NextResponse.json({ error: "not found" }, { status: 404 });

  const day = parseDay(req.nextUrl.searchParams.get("date"));
  const today = startOfToday();
  if (!day) return NextResponse.json({ error: "Pick a date." }, { status: 400 });
  if (day < today) return NextResponse.json({ error: "That date has passed." }, { status: 400 });

  const origin = await ensureVenueLocation(account);
  const everyone = await actsFreeOn(day, today, origin);
  const showAll = req.nextUrl.searchParams.get("all") === "1" || !origin;
  const acts = withinReach(everyone, showAll ? null : DEFAULT_RADIUS_MILES);
  return NextResponse.json({
    ok: true,
    acts,
    located: !!origin, // false = we couldn't place the venue's town, so nothing was filtered
    radiusMiles: showAll ? null : DEFAULT_RADIUS_MILES,
    hiddenFarAway: everyone.length - acts.length,
  });
}
