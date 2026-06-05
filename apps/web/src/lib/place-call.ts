// Shared Tulio call placement: assemble the brief, apply every calling-
// compliance gate, dial via Vapi, and log the Call row. Used by the manual
// dialer, campaign runner, autopilot, and playbooks so they all behave
// identically.
//
// Returns a discriminated outcome:
//   ok           — call placed
//   retry: true  — transient (not configured / off-hours) — caller should try later
//   skip: true   — permanent for now (no phone / opted out / called recently)
//   (neither)    — hard failure (provider error / venue missing)

import { prisma } from "@gigify/db";
import { assembleVenueBrief } from "@/lib/assemble-brief";
import { placeCall, toE164, vapiConfigured } from "@/lib/vapi";
import { isWithinCallingHours, MIN_DAYS_BETWEEN_CALLS } from "@/lib/calling-compliance";

export type PlaceCallOutcome = {
  ok: boolean;
  retry?: boolean;
  skip?: boolean;
  reason?: string;
  callId?: string;
};

export async function placeCallForVenue(
  venueId: string,
  opts: { scriptVariant: string }
): Promise<PlaceCallOutcome> {
  if (!vapiConfigured()) return { ok: false, retry: true, reason: "calling not configured" };

  const assembled = await assembleVenueBrief(venueId);
  if (!assembled) return { ok: false, reason: "venue not found" };

  const number = toE164(assembled.venue.phone);
  if (!number) return { ok: false, skip: true, reason: "no valid phone" };

  const dnc = await prisma.venue.findUnique({ where: { id: venueId }, select: { optedOut: true } });
  if (dnc?.optedOut) return { ok: false, skip: true, reason: "opted out" };

  const window = isWithinCallingHours(assembled.venue.state);
  if (!window.ok) return { ok: false, retry: true, reason: window.reason ?? "outside calling hours" };

  const since = new Date(Date.now() - MIN_DAYS_BETWEEN_CALLS * 24 * 60 * 60 * 1000);
  const recent = await prisma.call.findFirst({ where: { venueId, calledAt: { gte: since } }, select: { id: true } });
  if (recent) return { ok: false, skip: true, reason: "called recently" };

  const call = await placeCall({ toNumber: number, brief: assembled.brief, metadata: { venueId, artistId: assembled.artistId } });
  if (!call.ok) return { ok: false, reason: call.error };

  await prisma.call.create({
    data: {
      venueId,
      artistId: assembled.artistId,
      vapiCallId: call.callId || null,
      status: "INITIATED",
      calledAt: new Date(),
      scriptVariant: opts.scriptVariant,
    },
  });

  return { ok: true, callId: call.callId };
}
