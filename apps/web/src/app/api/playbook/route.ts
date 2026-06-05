import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { DEFAULT_CADENCE } from "@/lib/playbook";

export const dynamic = "force-dynamic";

// Manage playbook enrollments — the multi-step follow-up cadence.
//   GET  → list enrollments + the cadence definition
//   POST { venueIds, startAt? } → enroll venues (idempotent per venue)
//   PATCH { id|venueId, status } → stop/resume an enrollment
export async function GET() {
  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const enrollments = await prisma.playbookEnrollment.findMany({
    where: { artistId: artist.id },
    orderBy: { nextActionAt: "asc" },
    include: { venue: { select: { name: true, city: true, state: true } } },
  });

  const counts = enrollments.reduce<Record<string, number>>((acc, e) => {
    acc[e.status] = (acc[e.status] ?? 0) + 1;
    return acc;
  }, {});

  return NextResponse.json({
    ok: true,
    cadence: DEFAULT_CADENCE,
    counts,
    enrollments: enrollments.map((e) => ({
      id: e.id, venueId: e.venueId, venue: e.venue,
      stepIndex: e.stepIndex, status: e.status,
      nextActionAt: e.nextActionAt.toISOString(),
      lastReason: e.lastReason,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { venueIds?: string[]; startAt?: string };
  const venueIds = Array.isArray(body.venueIds) ? [...new Set(body.venueIds)] : [];
  if (venueIds.length === 0) return NextResponse.json({ error: "venueIds required" }, { status: 400 });

  const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const nextActionAt = body.startAt ? new Date(body.startAt) : new Date();

  // Idempotent: skip venues already enrolled.
  const existing = new Set(
    (await prisma.playbookEnrollment.findMany({ where: { venueId: { in: venueIds } }, select: { venueId: true } }))
      .map((e) => e.venueId)
  );
  const toEnroll = venueIds.filter((v) => !existing.has(v));

  if (toEnroll.length > 0) {
    await prisma.playbookEnrollment.createMany({
      data: toEnroll.map((venueId) => ({ artistId: artist.id, venueId, nextActionAt })),
    });
  }

  return NextResponse.json({ ok: true, enrolled: toEnroll.length, skipped: venueIds.length - toEnroll.length });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { id?: string; venueId?: string; status?: string };
  if (!body.status) return NextResponse.json({ error: "status required" }, { status: 400 });
  const where = body.id ? { id: body.id } : body.venueId ? { venueId: body.venueId } : null;
  if (!where) return NextResponse.json({ error: "id or venueId required" }, { status: 400 });

  const updated = await prisma.playbookEnrollment.update({ where, data: { status: body.status } });
  return NextResponse.json({ ok: true, enrollment: updated });
}
