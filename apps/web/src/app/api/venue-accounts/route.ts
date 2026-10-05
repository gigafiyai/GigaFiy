import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createVenueAccount } from "@/lib/venue-accounts";
import { findOrCreateSignup } from "@/lib/signups";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(200),
  contactName: z.string().trim().max(120).optional(),
  ref: z.string().trim().max(32).optional(),
});

// Create a venue workspace. Always makes a NEW workspace, even for an email
// that has one already: workspaces are never looked up by email, so nobody can
// reach someone else's bookings by typing their address.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please fill in your venue name, town and a valid email." }, { status: 400 });

  const account = await createVenueAccount(parsed.data);
  // Also count them as a venue on the early-access list (and credit a referrer).
  await findOrCreateSignup({ email: parsed.data.email, role: "venue", city: parsed.data.city, ref: parsed.data.ref }).catch(() => {});
  return NextResponse.json({ ok: true, token: account.accessToken });
}
