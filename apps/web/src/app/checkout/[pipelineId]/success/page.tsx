import { notFound } from "next/navigation";
import { prisma } from "@gigify/db";
import { SuccessFlow } from "./success-flow";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  params,
}: {
  params: { pipelineId: string };
}) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: params.pipelineId },
    include: {
      venue: true,
      artist: true,
      surveys: { where: { surveyType: "POST_BOOKING" }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  if (!pipeline) notFound();

  const survey = pipeline.surveys[0] ?? null;
  const deadline = pipeline.cancellationDeadline?.toISOString() ?? null;

  return (
    <SuccessFlow
      pipelineId={pipeline.id}
      stage={pipeline.stage}
      artistName={pipeline.artist.name}
      venueName={pipeline.venue.name}
      survey={
        survey
          ? { id: survey.id, completed: !!survey.completedAt }
          : null
      }
      cancellationDeadline={deadline}
    />
  );
}
