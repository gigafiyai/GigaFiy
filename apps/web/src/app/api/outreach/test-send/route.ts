import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { sendEmail } from "@/lib/sendgrid";

export const dynamic = "force-dynamic";

// Send a single test email to verify the email provider (Resend/SendGrid) is
// wired correctly. Hit this from a browser:
//   /api/outreach/test-send?to=you@example.com
// Defaults to the artist's contact email if `to` is omitted. Returns the
// provider mode + messageId (or the error) so you can see exactly what
// happened without digging through logs.
export async function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get("to");

  let recipient = to;
  if (!recipient) {
    const artist = await prisma.artist.findFirst({ orderBy: { createdAt: "asc" } });
    recipient = artist?.contactEmail ?? null;
  }
  if (!recipient) {
    return NextResponse.json(
      { ok: false, error: "No recipient — pass ?to=you@example.com" },
      { status: 400 }
    );
  }

  const result = await sendEmail({
    to: recipient,
    subject: "Gigify test email ✓",
    text:
      "This is a test from Gigify.\n\n" +
      "If you're reading this, the email provider is wired correctly and " +
      "live sends will work.\n\n— Gigify",
  });

  return NextResponse.json({
    ok: result.delivered,
    recipient,
    mode: result.mode, // "resend" | "sendgrid" | "logged"
    messageId: result.messageId,
    error: result.error ?? null,
    hint:
      result.mode === "logged"
        ? "No provider key detected at runtime — RESEND_API_KEY not set on the server."
        : result.error
        ? "Provider rejected the send — usually the 'from' domain isn't verified. See the error."
        : "Sent. Check the inbox (and spam).",
  });
}
