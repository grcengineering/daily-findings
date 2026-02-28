import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getEffectivePathId,
  getMissingPrerequisites,
  getNextTopic,
  getPathById,
  getRecommendationReason,
  getTopicById,
} from "@/lib/curriculum";

function safeJsonParse(json: string, fallback: unknown = null) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  try {
    const topicId = request.nextUrl.searchParams.get("topicId");
    const overridePrereq = request.nextUrl.searchParams.get("overridePrereq") === "1";

    if (topicId && !getTopicById(topicId)) {
      return NextResponse.json({ error: "Invalid topic id" }, { status: 400 });
    }

    let sessionContent;
    let recommendationReason: string | null = null;

    if (topicId) {
      if (!overridePrereq) {
        const completed = await prisma.topicProgress.findMany({
          select: { topicId: true },
        });
        const missing = getMissingPrerequisites(
          topicId,
          completed.map((row) => row.topicId)
        );
        if (missing.length > 0) {
          return NextResponse.json(
            {
              error: "Recommended prerequisites are not complete",
              missingPrerequisites: missing,
            },
            { status: 409 }
          );
        }
      }

      sessionContent = await prisma.sessionContent.findUnique({
        where: { topicId },
      });

      if (!sessionContent) {
        return NextResponse.json(
          { error: "Session not found in library" },
          { status: 404 }
        );
      }
    } else {
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
      const lastCompletion = await prisma.sessionCompletion.findFirst({
        orderBy: { completedAt: "desc" },
      });
      const lastDomain = lastCompletion
        ? (await prisma.sessionContent.findFirst({ where: { topicId: lastCompletion.topicId } }))?.domain ?? null
        : null;
      const userStats = await prisma.userStats.findUnique({ where: { id: "user" } });
      const effectivePathId = getEffectivePathId(userStats?.selectedPathId ?? null);
      const selectedPath = getPathById(effectivePathId);
      const topic = getNextTopic(completedIds, lastDomain, {
        pathModuleIds: selectedPath?.module_ids,
        topicQuizAverages,
        weakTopicIds,
      });
      recommendationReason = getRecommendationReason({
        topic,
        completedTopicIds: completedIds,
        pathId: effectivePathId,
        topicQuizAverages,
      });

      sessionContent = await prisma.sessionContent.findUnique({
        where: { topicId: topic.id },
      });

      if (!sessionContent) {
        return NextResponse.json(
          { error: "Recommended session has not been generated yet. Please run the library generator." },
          { status: 404 }
        );
      }
    }
    
    const today = new Date().toISOString().split("T")[0];
    const todayCompletion = await prisma.sessionCompletion.findFirst({
      where: { topicId: sessionContent.topicId, date: today },
    });

    return NextResponse.json(
      {
        id: sessionContent.id,
        topicId: sessionContent.topicId,
        domain: sessionContent.domain,
        topic: sessionContent.topic,
        level: sessionContent.level,
        moduleType: sessionContent.moduleType,
        competencyIds: safeJsonParse(sessionContent.competencyIds, []),
        prerequisites: safeJsonParse(sessionContent.prerequisites, []),
        lesson: safeJsonParse(sessionContent.lessonContent),
        scenario: safeJsonParse(sessionContent.scenarioContent),
        quiz: safeJsonParse(sessionContent.quizContent, { questions: [] }),
        capstone: safeJsonParse(sessionContent.capstoneContent ?? "null"),
        completed: todayCompletion != null,
        quizScore: todayCompletion?.quizScore ?? null,
        quizTotal: todayCompletion?.quizTotal ?? null,
        recommendationReason,
      },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
    );
  } catch (error) {
    console.error("Failed to load session:", error);
    return NextResponse.json(
      { error: "Failed to load session" },
      { status: 500 }
    );
  }
}
