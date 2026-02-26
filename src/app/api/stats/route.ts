import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAllTopics, getDomainProgress } from "@/lib/curriculum";

export async function GET() {
  try {
    const stats = await prisma.userStats.upsert({
      where: { id: "user" },
      create: {
        id: "user",
        currentStreak: 0,
        longestStreak: 0,
        totalSessions: 0,
        totalXp: 0,
        currentLevel: 1,
      },
      update: {},
    });

    const completions = await prisma.sessionCompletion.findMany({
      orderBy: { completedAt: "desc" },
      take: 100,
      select: {
        id: true,
        topicId: true,
        date: true,
        quizScore: true,
        quizTotal: true,
        completedAt: true,
      },
    });

    const allTopics = getAllTopics();
    const topicMetaById = new Map(allTopics.map((topic) => [topic.id, topic]));
    const validTopicIds = new Set(allTopics.map((topic) => topic.id));
    const validCompletions = completions.filter((completion) =>
      validTopicIds.has(completion.topicId)
    );

    const topicIds = Array.from(new Set(validCompletions.map((c) => c.topicId)));
    const contentRows = topicIds.length
      ? await prisma.sessionContent.findMany({
          where: { topicId: { in: topicIds } },
          select: {
            topicId: true,
            domain: true,
            topic: true,
            level: true,
          },
        })
      : [];
    const contentByTopicId = new Map(contentRows.map((r) => [r.topicId, r]));

    const recentSessions = validCompletions.slice(0, 10).map((c) => {
      const content = contentByTopicId.get(c.topicId);
      const topicMeta = topicMetaById.get(c.topicId);
      return {
        id: c.id,
        date: c.date,
        domain: topicMeta?.domain ?? content?.domain ?? "Unknown",
        topic: topicMeta?.title ?? content?.topic ?? c.topicId,
        topicId: c.topicId,
        level: topicMeta?.level ?? content?.level ?? "unknown",
        completed: true,
        quizScore: c.quizScore ?? null,
        quizTotal: c.quizTotal ?? null,
        startedAt: null,
        completedAt: c.completedAt,
        createdAt: c.completedAt,
      };
    });

    const domainInfo = getDomainProgress();
    const allProgress = (await prisma.topicProgress.findMany()).filter((progressRow) =>
      validTopicIds.has(progressRow.topicId)
    );

    const completedByDomain: Record<string, number> = {};
    for (const p of allProgress) {
      const canonicalDomain = topicMetaById.get(p.topicId)?.domain ?? p.domain;
      completedByDomain[canonicalDomain] = (completedByDomain[canonicalDomain] ?? 0) + 1;
    }

    const domainProgress: Record<string, { total: number; completed: number }> = {};
    for (const [name, { total }] of Object.entries(domainInfo)) {
      domainProgress[name] = {
        total,
        completed: Math.min(total, completedByDomain[name] ?? 0),
      };
    }

    return NextResponse.json({
      stats,
      recentSessions,
      domainProgress,
    });
  } catch (error) {
    console.error("Failed to fetch stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
