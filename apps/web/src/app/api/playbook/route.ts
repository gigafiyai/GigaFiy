import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { getAuthedArtist } from "@/lib/tenant";
import { DEFAULT_CADENCE } from "@/lib/playbook";

export const dynamic = "force-dynamic";

// Manage playbook enrollments — the multi-step follow-up cadence.
//   GET  → list enrollments + the cadence definition
//   POST { venueIds, startAt? } → enroll venues (idempotent per venue)
//   PATCH { id|venueId, status } → stop/resume an enrollment
export async function GET() {
  const artist = await getAuthedArtist();
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

  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "no artist" }, { status: 404 });

  const nextActionAt = body.startAt ? new Date(body.startAt) : new Date();

  // Scope to the artist's own venues (never enroll another tenant's).
  const ownedIds = new Set(
    (await prisma.venue.findMany({ where: { id: { in: venueIds }, artistId: artist.id }, select: { id: true } }))
      .map((v) => v.id)
  );
  // Idempotent: skip venues already enrolled.
  const existing = new Set(
    (await prisma.playbookEnrollment.findMany({ where: { venueId: { in: venueIds } }, select: { venueId: true } }))
      .map((e) => e.venueId)
  );
  const toEnroll = venueIds.filter((v) => ownedIds.has(v) && !existing.has(v));

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
  if (!body.id && !body.venueId) return NextResponse.json({ error: "id or venueId required" }, { status: 400 });

  const artist = await getAuthedArtist();
  if (!artist) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Tenant guard: only the artist's own enrollment.
  const updated = await prisma.playbookEnrollment.updateMany({
    where: { artistId: artist.id, ...(body.id ? { id: body.id } : { venueId: body.venueId }) },
    data: { status: body.status },
  });
  if (updated.count === 0) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ok: true, updated: updated.count });
}
