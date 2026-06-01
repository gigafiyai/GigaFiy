import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// SendGrid Event Webhook — receives open/click/bounce/unsubscribe events.
// Configure in SendGrid: Settings → Mail Settings → Event Webhook
// URL: https://yourdomain.com/api/sendgrid/events
// Events to enable: Open, Click, Bounce, Spam Report, Unsubscribe

type SendGridEvent = {
  event: "open" | "click" | "bounce" | "spamreport" | "unsubscribe" | "delivered" | "dropped";
  email: string;
  timestamp: number;
  sg_message_id?: string;
  url?: string; // for click events
  reason?: string; // for bounce
};

export async function POST(req: NextRequest) {
  // SendGrid sends an array of events.
  let events: SendGridEvent[];
  try {
    events = await req.json();
    if (!Array.isArray(events)) events = [events];
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  let processed = 0;

  for (const evt of events) {
    const now = new Date(evt.timestamp * 1000);

    // Find the outreach record by SendGrid message ID or recipient email.
    const outreach = evt.sg_message_id
      ? await prisma.outreach.findFirst({
          where: { sendgridMessageId: { contains: evt.sg_message_id.split(".")[0] } },
          orderBy: { sentAt: "desc" },
        })
      : await prisma.outreach.findFirst({
          where: {
            venue: {
              OR: [
                { decisionMakerEmail: { equals: evt.email, mode: "insensitive" } },
                { email: { equals: evt.email, mode: "insensitive" } },
              ],
            },
            channel: "EMAIL",
            status: { in: ["SENT", "OPENED"] },
          },
          orderBy: { sentAt: "desc" },
        });

    if (!outreach) {
      console.log(`[sendgrid-event] no match for ${evt.event} from ${evt.email}`);
      continue;
    }

    switch (evt.event) {
      case "open":
        if (!outreach.openedAt) {
          await prisma.outreach.update({
            where: { id: outreach.id },
            data: { status: "OPENED", openedAt: now },
          });
          // Mirror on pipeline so the call queue sorts correctly.
          await prisma.pipeline.updateMany({
            where: { venueId: outreach.venueId, stage: "EMAILED" },
            data: { emailOpened: true },
          });
        }
        break;

      case "click":
        await prisma.outreach.update({
          where: { id: outreach.id },
          data: {
            status: "CLICKED",
            clickedAt: now,
            openedAt: outreach.openedAt ?? now, // clicked implies opened
          },
        });
        await prisma.pipeline.updateMany({
          where: { venueId: outreach.venueId },
          data: { emailOpened: true },
        });
        break;

      case "bounce":
      case "dropped":
        // Mark email as dead — exclude from future sends.
        await prisma.outreach.update({
          where: { id: outreach.id },
          data: { status: "OPTED_OUT" },
        });
        // Clear the email from the venue so enrichment retries.
        if (evt.event === "bounce") {
          await prisma.venue.updateMany({
            where: {
              OR: [
                { decisionMakerEmail: { equals: evt.email, mode: "insensitive" } },
                { email: { equals: evt.email, mode: "insensitive" } },
              ],
            },
            data: {
              decisionMakerEmail: null,
              email: null,
            },
          });
          console.log(`[sendgrid-event] bounced ${evt.email} — cleared from venue`);
        }
        break;

      case "spamreport":
      case "unsubscribe":
        await prisma.outreach.update({
          where: { id: outreach.id },
          data: { status: "OPTED_OUT" },
        });
        await prisma.pipeline.updateMany({
          where: { venueId: outreach.venueId },
          data: { stage: "DECLINED" },
        });
        console.log(`[sendgrid-event] ${evt.event} from ${evt.email} — marked declined`);
        break;
    }

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
