import { NextRequest, NextResponse } from "next/server";
import { handlers, authConfigured } from "@/lib/auth";

// Until sign-in is configured, Auth.js has no secret and every call here would
// 500. In that single-tenant mode there is simply no session, so say so.
export async function GET(req: NextRequest) {
  if (!authConfigured) return NextResponse.json(null);
  return handlers.GET(req);
}

export async function POST(req: NextRequest) {
  if (!authConfigured) return NextResponse.json({ error: "sign-in is not configured" }, { status: 404 });
  return handlers.POST(req);
}
