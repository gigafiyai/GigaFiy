import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { gemsPerItem, type CampaignChannel } from "@/lib/gems";

export const dynamic = "force-dynamic";

// Manage the always-on daily-budget autopilot.
//   GET  → list autopilots + today's spend
//   POST { channel, dailyGemBudget, minLeadTier? } → create/replace
//   PATCH { id, status?, dailyGemBudget?, minLeadTier? } → update (pause/resume/tune)
export async function GET() {
  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const autos = await prisma.autopilot.findMany({ where: { artistId: artist.id }, orderBy: { createdAt: "desc" } });
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  const withSpend = await Promise.all(
    autos.map(async (a) => {
      const rows = await prisma.gemTransaction.findMany({
        where: { autopilotId: a.id, createdAt: { gte: startOfToday } },
        select: { delta: true },
      });
      const spentToday = rows.reduce((s, r) => s + Math.max(0, -r.delta), 0);
      return {
        id: a.id, channel: a.channel, status: a.status, dailyGemBudget: a.dailyGemBudget,
        minLeadTier: a.minLeadTier, spentToday,
        callsToday: Math.round(spentToday / gemsPerItem(a.channel === "email" ? "email" : "call")),
        remainingToday: Math.max(0, a.dailyGemBudget - spentToday),
      };
    })
  );

  return NextResponse.json({ ok: true, balance: artist.gemBalance, autopilots: withSpend });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    channel?: CampaignChannel; dailyGemBudget?: number; minLeadTier?: string;
  };
  const channel: CampaignChannel = body.channel === "email" ? "email" : "call";
  const dailyGemBudget = Math.max(0, Math.floor(body.dailyGemBudget ?? 0));
  if (dailyGemBudget <= 0) return NextResponse.json({ error: "dailyGemBudget required" }, { status: 400 });

  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const auto = await prisma.autopilot.create({
    data: { artistId: artist.id, channel, dailyGemBudget, minLeadTier: body.minLeadTier ?? null, status: "active" },
  });
  return NextResponse.json({ ok: true, autopilot: auto });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    id?: string; status?: "active" | "paused"; dailyGemBudget?: number; minLeadTier?: string | null;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (body.status) { data.status = body.status; data.pausedAt = body.status === "paused" ? new Date() : null; }
  if (typeof body.dailyGemBudget === "number") data.dailyGemBudget = Math.max(0, Math.floor(body.dailyGemBudget));
  if (body.minLeadTier !== undefined) data.minLeadTier = body.minLeadTier;

  const auto = await prisma.autopilot.update({ where: { id: body.id }, data });
  return NextResponse.json({ ok: true, autopilot: auto });
}
