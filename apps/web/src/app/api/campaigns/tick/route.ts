import { NextRequest, NextResponse } from "next/server";
import { runTick } from "@/lib/run-tick";

export const dynamic = "force-dynamic";

// Cron entry point — protect with CRON_SECRET in production.
//   POST /api/campaigns/tick   (header: x-cron-secret: <CRON_SECRET>)
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runTick();
  return NextResponse.json(result);
}
