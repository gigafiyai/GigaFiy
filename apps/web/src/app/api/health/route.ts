import { NextResponse } from "next/server";
import { integrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

// Integration readiness — which services are wired. Powers the system-status
// panel so go-live config is self-evident.
export async function GET() {
  return NextResponse.json({
    ok: true,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    integrations: integrationStatus(),
  });
}
