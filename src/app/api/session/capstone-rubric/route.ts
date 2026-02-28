import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  const topicId = request.nextUrl.searchParams.get("topicId");
  if (!topicId) {
    return NextResponse.json({ error: "topicId is required" }, { status: 400 });
  }
  const row = await prisma.sessionCompletion.findUnique({
    where: { topicId_date: { topicId, date: todayDateString() } },
    select: { capstoneRubricScores: true },
  });
  if (row?.capstoneRubricScores) {
    return NextResponse.json({
      rubricScores: JSON.parse(row.capstoneRubricScores),
    });
  }
  const draft = await prisma.capstoneRubricState.findUnique({
    where: { topicId_date: { topicId, date: todayDateString() } },
    select: { rubricScores: true },
  });
  return NextResponse.json({
    rubricScores: draft?.rubricScores ? JSON.parse(draft.rubricScores) : {},
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topicId = typeof body?.topicId === "string" ? body.topicId : "";
    const rubricScores =
      body?.rubricScores && typeof body.rubricScores === "object"
        ? body.rubricScores
        : {};
    if (!topicId) {
      return NextResponse.json({ error: "topicId is required" }, { status: 400 });
    }

    const date = todayDateString();
    await prisma.capstoneRubricState.upsert({
      where: { topicId_date: { topicId, date } },
      create: {
        topicId,
        date,
        rubricScores: JSON.stringify(rubricScores),
      },
      update: {
        rubricScores: JSON.stringify(rubricScores),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to save rubric scores" }, { status: 500 });
  }
}
