import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { assembleVenueBrief } from "@/lib/assemble-brief";
import { placeCall, toE164, vapiConfigured } from "@/lib/vapi";
import { isWithinCallingHours, MIN_DAYS_BETWEEN_CALLS } from "@/lib/calling-compliance";
import { ACK_REQUIRED, recordCallAck } from "@/lib/call-consent";
import { getAuthedArtist } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const Body = z.object({
  venueId: z.string().optional(),
  venueIds: z.array(z.string()).optional(),
  ack: z.boolean().optional(), // compliance attestation — required to place calls
});

// Place a real Tulio call to one venue (or a batch).
//   POST { venueId }            → call one venue
//   POST { venueIds: [...] }    → call several (premium "call my 50 best leads")
//
// Each call: assemble the venue's brief, dial via Vapi, log a Call row
// (status INITIATED) with the Vapi call id so the webhook can attach the
// transcript/recording + analysis when the call ends.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }
  const body = parsed.data;
  if (!body.ack) {
    return NextResponse.json(ACK_REQUIRED, { status: 403 });
  }
  const authed = await getAuthedArtist();
  if (authed) await recordCallAck(authed.id);
  const ids = body.venueIds?.length ? body.venueIds : body.venueId ? [body.venueId] : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "venueId or venueIds required" }, { status: 400 });
  }
  if (!vapiConfigured()) {
    return NextResponse.json(
      { error: "Calling not configured — set VAPI_API_KEY and VAPI_PHONE_NUMBER_ID", configured: false },
      { status: 503 }
    );
  }

  const results: Array<{ venueId: string; ok: boolean; callId?: string; error?: string; skipped?: string }> = [];

  for (const venueId of ids) {
    const assembled = await assembleVenueBrief(venueId);
    if (!assembled) {
      results.push({ venueId, ok: false, error: "venue not found" });
      continue;
    }
    // Tenant guard: never dial a venue that isn't this artist's.
    if (authed && assembled.artistId !== authed.id) {
      results.push({ venueId, ok: false, skipped: "not your venue" });
      continue;
    }

    const number = toE164(assembled.venue.phone);
    if (!number) {
      results.push({ venueId, ok: false, skipped: "no valid phone number" });
      continue;
    }

    // ── Compliance gates — refuse to place a non-compliant call ──
    // 1. Do-not-call / opt-out suppression.
    const compliance = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { optedOut: true },
    });
    if (compliance?.optedOut) {
      results.push({ venueId, ok: false, skipped: "opted out / do-not-call" });
      continue;
    }

    // 2. TCPA calling hours — 8am–9pm in the venue's local time.
    const window = isWithinCallingHours(assembled.venue.state);
    if (!window.ok) {
      results.push({ venueId, ok: false, skipped: window.reason ?? "outside calling hours" });
      continue;
    }

    // 3. Contact-frequency cap — don't re-call the same venue too soon.
    const since = new Date(Date.now() - MIN_DAYS_BETWEEN_CALLS * 24 * 60 * 60 * 1000);
    const recentCall = await prisma.call.findFirst({
      where: { venueId, calledAt: { gte: since } },
      select: { id: true },
    });
    if (recentCall) {
      results.push({ venueId, ok: false, skipped: `called within last ${MIN_DAYS_BETWEEN_CALLS} days` });
      continue;
    }

    const call = await placeCall({
      toNumber: number,
      brief: assembled.brief,
      metadata: { venueId, artistId: assembled.artistId },
    });

    if (!call.ok) {
      results.push({ venueId, ok: false, error: call.error });
      continue;
    }

    await prisma.call.create({
      data: {
        venueId,
        artistId: assembled.artistId,
        vapiCallId: call.callId || null,
        status: "INITIATED",
        calledAt: new Date(),
        scriptVariant: "tulio_brief",
      },
    });

    results.push({ venueId, ok: true, callId: call.callId });
  }

  const placed = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  return NextResponse.json({
    ok: true,
    placed,
    skipped,
    attempted: ids.length,
    results,
  });
}
