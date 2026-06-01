import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const pipelineId = req.nextUrl.searchParams.get("pipelineId");
  if (!pipelineId) return NextResponse.json({ error: "pipelineId required" }, { status: 400 });

  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: {
      surveys: { where: { surveyType: "POST_BOOKING" }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!pipeline) return NextResponse.json({ error: "not found" }, { status: 404 });

  const survey = pipeline.surveys[0] ?? null;
  return NextResponse.json({
    stage: pipeline.stage,
    surveyId: survey?.id ?? null,
    surveyCompleted: !!survey?.completedAt,
  });
}
