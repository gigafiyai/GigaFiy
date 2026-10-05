import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@gigify/db";
import { sendEmail } from "@/lib/email";
import { integrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200) });

// One recovery email per address every 10 minutes, so this can't be used to
// flood someone's inbox. In-memory is enough for a single server.
const lastSent = new Map<string, number>();
const COOLDOWN_MS = 10 * 60 * 1000;

// POST { email } → email that address the link(s) to its venue page(s).
// The response is the same whether or not the address has a venue page, so
// this can't be used to find out who is on Gigify. Links only ever go to the
// inbox, never back to the browser.
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  if (!integrationStatus().email.configured) {
    return NextResponse.json(
      { error: "We can't send recovery emails yet. If you saved or bookmarked your venue link, use that for now." },
      { status: 503 }
    );
  }

  const { email } = parsed.data;
  const now = Date.now();
  const recently = (lastSent.get(email) ?? 0) > now - COOLDOWN_MS;
  if (!recently) {
    lastSent.set(email, now);
    const accounts = await prisma.venueAccount.findMany({ where: { email }, orderBy: { createdAt: "asc" } });
    if (accounts.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const lines = accounts.map((a) => `${a.name} (${a.city})\n${appUrl}/venue/${a.accessToken}`);
      const result = await sendEmail({
        to: email,
        subject: accounts.length === 1 ? `Your Gigify venue page: ${accounts[0].name}` : "Your Gigify venue pages",
        text: [
          "Here's the private link to your venue page on Gigify:",
          "",
          lines.join("\n\n"),
          "",
          "Anyone with this link can manage the page, so keep it to people who book for you.",
          "",
          "If you didn't ask for this, you can ignore this email.",
        ].join("\n"),
      });
      if (!result.delivered) console.error("[venue-recover] send failed:", result.error ?? result.mode);
    }
  }

  return NextResponse.json({ ok: true });
}
