import { NextRequest, NextResponse } from "next/server";
import { venueAccountByToken, parseDay, actsFreeOn } from "@/lib/venue-accounts";
import { startOfToday } from "@/lib/today";

export const dynamic = "force-dynamic";

// GET ?date=YYYY-MM-DD → acts with nothing on their calendar that day.
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const account = await venueAccountByToken(params.token);
  if (!account) return NextResponse.json({ error: "not found" }, { status: 404 });

  const day = parseDay(req.nextUrl.searchParams.get("date"));
  const today = startOfToday();
  if (!day) return NextResponse.json({ error: "Pick a date." }, { status: 400 });
  if (day < today) return NextResponse.json({ error: "That date has passed." }, { status: 400 });

  return NextResponse.json({ ok: true, acts: await actsFreeOn(day, today) });
}
