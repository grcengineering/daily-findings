import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const topicId = typeof body?.topicId === "string" ? body.topicId : "";
    const questionId = typeof body?.questionId === "string" ? body.questionId : "";
    const questionIndex = Number(body?.questionIndex ?? 0);
    const format = typeof body?.format === "string" ? body.format : "multiple_choice";
    const correct = Boolean(body?.correct);
    const selectedIndex =
      body?.selectedIndex == null ? null : Number(body.selectedIndex);
    if (!topicId || !questionId || !Number.isFinite(questionIndex)) {
      return NextResponse.json({ error: "Invalid quiz answer payload" }, { status: 400 });
    }

    const existing = await prisma.questionAnalytics.findUnique({
      where: { topicId_questionId: { topicId, questionId } },
    });
    const optionStats = existing?.optionStats
      ? (JSON.parse(existing.optionStats) as Record<string, number>)
      : {};
    const key = String(selectedIndex ?? "null");
    optionStats[key] = (optionStats[key] ?? 0) + 1;

    const attemptCount = (existing?.attemptCount ?? 0) + 1;
    const prevCorrectCount = (existing?.correctRate ?? 0) * (existing?.attemptCount ?? 0);
    const nextCorrectCount = prevCorrectCount + (correct ? 1 : 0);

    await prisma.questionAnalytics.upsert({
      where: { topicId_questionId: { topicId, questionId } },
      create: {
        topicId,
        questionId,
        questionIndex: Math.round(questionIndex),
        format,
        attemptCount: 1,
        correctRate: correct ? 1 : 0,
        discrimination: null,
        firstTryCorrect: correct ? 1 : 0,
        retryCount: correct ? 0 : 1,
        optionStats: JSON.stringify(optionStats),
      },
      update: {
        questionIndex: Math.round(questionIndex),
        format,
        attemptCount,
        correctRate: nextCorrectCount / attemptCount,
        firstTryCorrect: (existing?.firstTryCorrect ?? 0) + (correct && !existing ? 1 : 0),
        retryCount: (existing?.retryCount ?? 0) + (correct ? 0 : 1),
        optionStats: JSON.stringify(optionStats),
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to track quiz answer" }, { status: 500 });
  }
}
