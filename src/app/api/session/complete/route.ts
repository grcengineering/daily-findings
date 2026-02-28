import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (origin) {
      const requestOrigin = request.nextUrl.origin;
      if (origin !== requestOrigin) {
        return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
      }
    }

    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(contentLength) && contentLength > 10_000) {
      return NextResponse.json(
        { error: "Request payload too large" },
        { status: 413 }
      );
    }

    const body = await request.json();
    const { topicId, quizScore, quizTotal, capstoneRubricScores, recommendationReason } = body;

    if (
      typeof topicId !== "string" ||
      !topicId ||
      !/^[A-Za-z0-9_:-]+$/.test(topicId) ||
      typeof quizScore !== "number" ||
      typeof quizTotal !== "number" ||
      !Number.isFinite(quizScore) ||
      !Number.isFinite(quizTotal) ||
      quizScore < 0 ||
      quizTotal < 0 ||
      quizScore > quizTotal ||
      !Number.isInteger(quizScore) ||
      !Number.isInteger(quizTotal)
    ) {
      return NextResponse.json({
        error:
          "Invalid input: topicId must be a string, quizScore and quizTotal must be non-negative integers with quizScore <= quizTotal",
      }, { status: 400 });
    }

    const sessionContent = await prisma.sessionContent.findUnique({
      where: { topicId },
    });

    if (!sessionContent) {
      return NextResponse.json({ error: "Topic not found in library" }, { status: 404 });
    }

    const today = todayDateString();

    const existing = await prisma.sessionCompletion.findFirst({
      where: { topicId, date: today },
    });

    if (existing) {
      const stats = await prisma.userStats.findUnique({ where: { id: "user" } });
      return NextResponse.json(stats ?? { message: "Session already completed today" }, {
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
      });
    }

    try {
      await prisma.sessionCompletion.create({
        data: {
          topicId,
          date: today,
          quizScore,
          quizTotal,
          capstoneRubricScores:
            capstoneRubricScores && typeof capstoneRubricScores === "object"
              ? JSON.stringify(capstoneRubricScores)
              : null,
          recommendationReason:
            typeof recommendationReason === "string" ? recommendationReason : null,
        },
      });
    } catch (createError: unknown) {
      const prismaError = createError as { code?: string };
      if (prismaError.code === "P2002") {
        const stats = await prisma.userStats.findUnique({ where: { id: "user" } });
        return NextResponse.json(stats ?? { message: "Session already completed today" }, {
          headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
        });
      }
      throw createError;
    }

    const scorePercent = quizTotal > 0 ? (quizScore / quizTotal) * 100 : 0;
    const reviewDays = scorePercent >= 80 ? 7 : 3;
    const nextReviewAt = new Date();
    nextReviewAt.setDate(nextReviewAt.getDate() + reviewDays);

    const existingProgress = await prisma.topicProgress.findUnique({
      where: { topicId },
    });

    let currentScores: number[] = [];
    if (existingProgress) {
      try {
        currentScores = JSON.parse(existingProgress.quizScores);
      } catch {
        currentScores = [];
      }
    }
    currentScores.push(quizScore);

    await prisma.topicProgress.upsert({
      where: { topicId },
      update: {
        timesStudied: { increment: 1 },
        lastStudied: new Date(),
        quizScores: JSON.stringify(currentScores),
        nextReviewAt,
      },
      create: {
        domain: sessionContent.domain,
        topicId,
        topic: sessionContent.topic,
        level: sessionContent.level,
        timesStudied: 1,
        lastStudied: new Date(),
        quizScores: JSON.stringify(currentScores),
        nextReviewAt,
      },
    });

    const yesterday = yesterdayDateString();
    const xpGained = 100 + Math.round((quizScore / Math.max(quizTotal, 1)) * 50);

    let stats = await prisma.userStats.findUnique({ where: { id: "user" } });

    if (!stats) {
      stats = await prisma.userStats.create({
        data: {
          id: "user",
          totalSessions: 0,
          totalXp: 0,
          currentLevel: 1,
          currentStreak: 0,
          longestStreak: 0,
        },
      });
    }

    let newStreak = stats.currentStreak;
    if (stats.lastSessionDate === yesterday) {
      newStreak = stats.currentStreak + 1;
    } else if (stats.lastSessionDate === today) {
      newStreak = stats.currentStreak;
    } else {
      newStreak = 1;
    }

    const newTotalXp = stats.totalXp + xpGained;
    const newLevel = Math.floor(newTotalXp / 500) + 1;
    const newLongest = Math.max(stats.longestStreak, newStreak);

    const updatedStats = await prisma.userStats.update({
      where: { id: "user" },
      data: {
        totalSessions: stats.totalSessions + 1,
        totalXp: newTotalXp,
        currentLevel: newLevel,
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastSessionDate: today,
      },
    });

    await prisma.capstoneRubricState.deleteMany({
      where: { topicId, date: today },
    });

    if (Array.isArray(body?.questionResults)) {
      for (const result of body.questionResults as Array<{
        questionId: string;
        questionIndex: number;
        format?: string;
        correct: boolean;
        selectedIndex?: number | null;
      }>) {
        if (!result?.questionId || typeof result.questionIndex !== "number") continue;
        const existing = await prisma.questionAnalytics.findUnique({
          where: { topicId_questionId: { topicId, questionId: result.questionId } },
        });
        const optionStats = existing?.optionStats ? JSON.parse(existing.optionStats) as Record<string, number> : {};
        const key = String(result.selectedIndex ?? "null");
        optionStats[key] = (optionStats[key] ?? 0) + 1;
        const attemptCount = (existing?.attemptCount ?? 0) + 1;
        const correctCount = (existing?.correctRate ?? 0) * (existing?.attemptCount ?? 0) + (result.correct ? 1 : 0);
        await prisma.questionAnalytics.upsert({
          where: { topicId_questionId: { topicId, questionId: result.questionId } },
          create: {
            topicId,
            questionId: result.questionId,
            questionIndex: result.questionIndex,
            format: result.format ?? "multiple_choice",
            attemptCount: 1,
            correctRate: result.correct ? 1 : 0,
            discrimination: null,
            firstTryCorrect: result.correct ? 1 : 0,
            retryCount: result.correct ? 0 : 1,
            optionStats: JSON.stringify(optionStats),
          },
          update: {
            questionIndex: result.questionIndex,
            format: result.format ?? existing?.format ?? "multiple_choice",
            attemptCount,
            correctRate: attemptCount > 0 ? correctCount / attemptCount : null,
            firstTryCorrect:
              (existing?.firstTryCorrect ?? 0) + (result.correct && !existing ? 1 : 0),
            retryCount: (existing?.retryCount ?? 0) + (!result.correct ? 1 : 0),
            optionStats: JSON.stringify(optionStats),
          },
        });
      }
    }

    return NextResponse.json(updatedStats, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Failed to complete session:", error);
    return NextResponse.json(
      { error: "Failed to complete session" },
      { status: 500 }
    );
  }
}
