import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Returns the deployed commit + build info so "is the new code live?" is a
// one-second check instead of an inference. Railway injects
// RAILWAY_GIT_COMMIT_SHA automatically on every deploy.
export async function GET() {
  const sha =
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    process.env.GIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    "unknown";

  return NextResponse.json({
    commit: sha,
    commitShort: sha.slice(0, 7),
    branch: process.env.RAILWAY_GIT_BRANCH ?? null,
    deployedAt: process.env.RAILWAY_DEPLOYMENT_ID ? "railway" : "local",
    bootedAt: BOOT_TIME, // when this server process started
    now: new Date().toISOString(),
  });
}

// Captured once at module load — tells you how long the current process has run.
const BOOT_TIME = new Date().toISOString();
