import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { venueAccountByToken, parseDay } from "@/lib/venue-accounts";
import { startOfToday } from "@/lib/today";

export const dynamic = "force-dynamic";

const Body = z.object({
  date: z.string(),
  budget: z.number().min(0).max(100000).nullable().optional(),
  notes: z.string().trim().max(500).optional(),
});

// POST → the venue lists a night it wants filled. Artists on Gigify can see it.
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const account = await venueAccountByToken(params.token);
  if (!account) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  const day = parsed.success ? parseDay(parsed.data.date) : null;
  if (!parsed.success || !day) return NextResponse.json({ error: "Pick a date." }, { status: 400 });
  if (day < startOfToday()) return NextResponse.json({ error: "That date has passed." }, { status: 400 });

  const night = await prisma.openNight.upsert({
    where: { venueAccountId_date: { venueAccountId: account.id, date: day } },
    create: { venueAccountId: account.id, date: day, budget: parsed.data.budget ?? null, notes: parsed.data.notes || null },
    update: { status: "open", budget: parsed.data.budget ?? null, notes: parsed.data.notes || null },
  });
  return NextResponse.json({ ok: true, id: night.id });
}

// DELETE ?id= → withdraw a night.
export async function DELETE(req: NextRequest, { params }: { params: { token: string } }) {
  const account = await venueAccountByToken(params.token);
  if (!account) return NextResponse.json({ error: "not found" }, { status: 404 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  await prisma.openNight.deleteMany({ where: { id, venueAccountId: account.id } });
  return NextResponse.json({ ok: true });
}
