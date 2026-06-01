import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { sendEmail } from "@/lib/sendgrid";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { venueId, subject, body } = (await req.json()) as {
    venueId?: string;
    subject?: string;
    body?: string;
  };
  if (!venueId || !subject || !body) {
    return NextResponse.json({ error: "venueId, subject, body required" }, { status: 400 });
  }

  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: { pipeline: true, artist: true },
  });
  if (!venue) {
    return NextResponse.json({ error: "venue not found" }, { status: 404 });
  }

  const recipient = venue.decisionMakerEmail ?? venue.email;
  const now = new Date();
  let deliveryMode: "sendgrid" | "logged" = "logged";
  let sendgridMessageId: string | null = null;
  let deliveryError: string | null = null;

  if (recipient) {
    const result = await sendEmail({
      to: recipient,
      subject,
      text: body,
      replyTo: venue.artist.contactEmail,
    });
    deliveryMode = result.mode;
    sendgridMessageId = result.messageId;
    if (result.error) deliveryError = result.error;
  }

  const outreach = await prisma.outreach.create({
    data: {
      venueId: venue.id,
      artistId: venue.artistId,
      channel: "EMAIL",
      status: "SENT",
      subjectLine: subject,
      body,
      sentAt: now,
      sendgridMessageId,
      variant: "a",
    },
  });

  if (venue.pipeline && venue.pipeline.stage === "QUEUED") {
    await prisma.pipeline.update({
      where: { id: venue.pipeline.id },
      data: { stage: "EMAILED" },
    });
  }

  return NextResponse.json({
    ok: true,
    deliveryMode,
    recipient,
    outreachId: outreach.id,
    error: deliveryError,
  });
}
