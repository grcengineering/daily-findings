import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAllPaths, getEffectivePathId, getNextTopic, getPathById, getRecommendationReason } from "@/lib/curriculum";

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const libraryCount = await prisma.sessionContent.count();
    if (libraryCount === 0) {
      return NextResponse.json({ session: null });
    }

    const allProgress = await prisma.topicProgress.findMany();
    const completedIds = allProgress.map((p) => p.topicId);
    const topicQuizAverages = Object.fromEntries(
      allProgress.map((row) => {
        let scores: number[] = [];
        try {
          scores = JSON.parse(row.quizScores) as number[];
        } catch {
          scores = [];
        }
        const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
        return [row.topicId, avg];
      })
    );
    const weakTopicIds = allProgress
      .filter((row) => {
        try {
          const scores = JSON.parse(row.quizScores) as number[];
          if (scores.length === 0) return false;
          const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          return avg < 75;
        } catch {
          return false;
        }
      })
      .map((row) => row.topicId);
    const userStats = await prisma.userStats.findUnique({ where: { id: "user" } });
    const effectivePathId = getEffectivePathId(userStats?.selectedPathId ?? null);
    const selectedPath = getPathById(effectivePathId);
    const lastCompletion = await prisma.sessionCompletion.findFirst({
      orderBy: { completedAt: "desc" },
    });
    const lastDomain = lastCompletion
      ? (await prisma.sessionContent.findFirst({ where: { topicId: lastCompletion.topicId } }))?.domain ?? null
      : null;

    const topic = getNextTopic(completedIds, lastDomain, {
      pathModuleIds: selectedPath?.module_ids,
      topicQuizAverages,
      weakTopicIds,
    });
    const recommendationReason = getRecommendationReason({
      topic,
      completedTopicIds: completedIds,
      pathId: effectivePathId,
      topicQuizAverages,
    });

    const sessionContent = await prisma.sessionContent.findUnique({
      where: { topicId: topic.id },
    });

    if (!sessionContent) {
      return NextResponse.json({ session: null });
    }

    const today = todayDateString();
    const todayCompletion = await prisma.sessionCompletion.findFirst({
      where: { topicId: topic.id, date: today },
    });
    const todayDailySession = await prisma.dailySession.findUnique({
      where: { date: today },
      select: {
        id: true,
        topicId: true,
        startedAt: true,
        completed: true,
      },
    });
    const inProgress =
      !!todayDailySession &&
      todayDailySession.topicId === sessionContent.topicId &&
      !todayDailySession.completed &&
      todayDailySession.startedAt != null;

    return NextResponse.json({
      session: {
        id: sessionContent.id,
        domain: sessionContent.domain,
        topic: sessionContent.topic,
        topicId: sessionContent.topicId,
        level: sessionContent.level,
        completed: todayCompletion != null,
        inProgress,
        quizScore: todayCompletion?.quizScore ?? null,
        quizTotal: todayCompletion?.quizTotal ?? null,
        recommendationReason,
        selectedPathId: effectivePathId,
        selectedPathTitle: selectedPath?.title ?? null,
        availablePaths: getAllPaths(),
      },
    });
  } catch (error) {
    console.error("Failed to check today's session:", error);
    return NextResponse.json(
      { error: "Failed to check today's session" },
      { status: 500 }
    );
  }
}
