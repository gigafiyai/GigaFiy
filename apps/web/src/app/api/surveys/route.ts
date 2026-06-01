import { NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const surveys = await prisma.survey.findMany({
    include: { venue: true, pipeline: true },
    orderBy: { createdAt: "desc" },
  });

  const result = surveys.map((s) => ({
    id: s.id,
    pipelineId: s.pipelineId,
    venueId: s.venueId,
    venueName: s.venue.name,
    city: s.venue.city,
    state: s.venue.state,
    surveyType: s.surveyType,
    completed: !!s.completedAt,
    completedAt: s.completedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
    answers: {
      q1: s.q1Answer,
      q2: s.q2Answer,
      q3: s.q3Answer,
      q4: s.q4Answer,
      q5: s.q5Answer,
    },
  }));

  return NextResponse.json(result);
}
