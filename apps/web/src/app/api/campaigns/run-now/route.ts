import { NextResponse } from "next/server";
import { runTick } from "@/lib/run-tick";

export const dynamic = "force-dynamic";

// In-app manual trigger — the "Run engine now" button. Same logic as the cron
// tick, no secret needed (consistent with the pilot's single-tenant posture),
// so the artist can fire everything due without waiting for the hourly cron.
export async function POST() {
  const result = await runTick();
  return NextResponse.json(result);
}
