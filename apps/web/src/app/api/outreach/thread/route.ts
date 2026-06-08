import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// The conversation with one venue: sent outreach + received replies, merged
// chronologically. Powers the Outreach inbox thread view.
//   GET /api/outreach/thread?venueId=
export async function GET(req: NextRequest) {
  const venueId = req.nextUrl.searchParams.get("venueId");
  if (!venueId) return NextResponse.json({ error: "venueId required" }, { status: 400 });

  const [sent, replies] = await Promise.all([
    prisma.outreach.findMany({
      where: { venueId, channel: "EMAIL" },
      orderBy: { createdAt: "asc" },
      select: { id: true, subjectLine: true, body: true, sentAt: true, createdAt: true, status: true },
    }),
    prisma.inboundReply.findMany({
      where: { venueId },
      orderBy: { receivedAt: "asc" },
      select: { id: true, fromName: true, fromEmail: true, subject: true, text: true, receivedAt: true, classification: true, summary: true },
    }),
  ]);

  type Item = {
    id: string; direction: "out" | "in"; at: string;
    subject: string | null; body: string;
    status?: string; from?: string; classification?: string | null;
  };

  const items: Item[] = [
    ...sent.map((o): Item => ({
      id: o.id, direction: "out", at: (o.sentAt ?? o.createdAt).toISOString(),
      subject: o.subjectLine, body: o.body ?? "", status: o.status,
    })),
    ...replies.map((r): Item => ({
      id: r.id, direction: "in", at: r.receivedAt.toISOString(),
      subject: r.subject, body: r.text, from: r.fromName ?? r.fromEmail, classification: r.classification,
    })),
  ].sort((a, b) => (a.at < b.at ? -1 : 1));

  return NextResponse.json({ ok: true, items, replyCount: replies.length });
}
