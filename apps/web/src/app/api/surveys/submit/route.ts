import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";
import { sendEmail } from "@/lib/sendgrid";
import { buildConfirmationEmail } from "@/lib/email-templates";

export const dynamic = "force-dynamic";

// Submits a Survey row's answers. Survey 1 completion gates the confirmation
// email (per build guide: Survey 1 fires in-app BEFORE the confirmation email).
export async function POST(req: NextRequest) {
  const { surveyId, answers } = (await req.json()) as {
    surveyId?: string;
    answers?: { q1?: string; q2?: string; q3?: string; q4?: string; q5?: string };
  };
  if (!surveyId || !answers) {
    return NextResponse.json({ error: "surveyId and answers required" }, { status: 400 });
  }

  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    include: {
      venue: true,
      pipeline: { include: { artist: true } },
    },
  });
  if (!survey) return NextResponse.json({ error: "survey not found" }, { status: 404 });

  await prisma.survey.update({
    where: { id: surveyId },
    data: {
      q1Answer: answers.q1 ?? null,
      q2Answer: answers.q2 ?? null,
      q3Answer: answers.q3 ?? null,
      q4Answer: answers.q4 ?? null,
      q5Answer: answers.q5 ?? null,
      completedAt: new Date(),
    },
  });

  // Survey 1 completion fires the confirmation email.
  let confirmationSent: { mode: string; recipient: string | null } | null = null;
  if (survey.surveyType === "POST_BOOKING") {
    const recipient =
      survey.venue.decisionMakerEmail ?? survey.venue.email ?? null;
    const { subject, text } = buildConfirmationEmail({
      artistName: survey.pipeline.artist.name,
      artistContactEmail: survey.pipeline.artist.contactEmail,
      venueName: survey.venue.name,
      contactFirstName:
        survey.venue.decisionMakerName?.split(" ")[0] ?? null,
      bookedShowDate: survey.pipeline.bookedShowDate,
      bookedShowFee: survey.pipeline.bookedShowFee,
      depositAmount: survey.pipeline.depositAmount,
      cancellationDeadline: survey.pipeline.cancellationDeadline,
    });

    if (recipient) {
      const result = await sendEmail({
        to: recipient,
        subject,
        text,
        replyTo: survey.pipeline.artist.contactEmail,
      });
      confirmationSent = { mode: result.mode, recipient };

      await prisma.outreach.create({
        data: {
          venueId: survey.venueId,
          artistId: survey.pipeline.artistId,
          channel: "EMAIL",
          status: "SENT",
          subjectLine: subject,
          body: text,
          sentAt: new Date(),
          sendgridMessageId: result.messageId,
          variant: "confirmation",
        },
      });
    } else {
      confirmationSent = { mode: "skipped_no_recipient", recipient: null };
    }
  }

  return NextResponse.json({
    ok: true,
    surveyId,
    confirmationSent,
  });
}
