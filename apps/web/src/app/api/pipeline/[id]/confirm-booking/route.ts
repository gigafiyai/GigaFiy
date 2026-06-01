import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@gigify/db";

export const dynamic = "force-dynamic";

// Closes the 24h cancellation window and books the show.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const pipeline = await prisma.pipeline.findUnique({ where: { id: params.id } });
  if (!pipeline) return NextResponse.json({ error: "pipeline not found" }, { status: 404 });

  if (pipeline.stage !== "DEPOSIT") {
    return NextResponse.json(
      { error: `cannot confirm from stage ${pipeline.stage}` },
      { status: 400 }
    );
  }

  const updated = await prisma.pipeline.update({
    where: { id: pipeline.id },
    data: { stage: "BOOKED" },
  });

  return NextResponse.json({ ok: true, pipelineId: updated.id });
}
