import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAllTopics } from "@/lib/curriculum";
import { DOMAINS } from "@/lib/domain-colors";

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
      select: {
        id: true,
        topicId: true,
        date: true,
        quizScore: true,
        quizTotal: true,
        completedAt: true,
      },
    });

    const completionTopicIds = Array.from(new Set(completions.map((c) => c.topicId)));
    const contentRows = completionTopicIds.length
      ? await prisma.sessionContent.findMany({
          where: { topicId: { in: completionTopicIds } },
          select: {
            topicId: true,
            domain: true,
            topic: true,
            level: true,
          },
        })
      : [];
    const contentByTopicId = new Map(contentRows.map((r) => [r.topicId, r]));

    const allSessions = completions.map((c) => {
      const content = contentByTopicId.get(c.topicId);
      return {
        id: c.id,
        date: c.date,
        domain: content?.domain ?? "Unknown",
        topic: content?.topic ?? c.topicId,
        topicId: c.topicId,
        level: content?.level ?? "unknown",
        completed: true,
        quizScore: c.quizScore ?? null,
        quizTotal: c.quizTotal ?? null,
      };
    });

    const topicProgress = await prisma.topicProgress.findMany();

    const allTopics = getAllTopics();
    const topicsByDomain: Record<string, number> = {};
    for (const t of allTopics) {
      topicsByDomain[t.domain] = (topicsByDomain[t.domain] ?? 0) + 1;
    }

    const domainProgress: Record<
      string,
      { total: number; completed: number; avgScore: number }
    > = {};

    for (const domain of DOMAINS) {
      const total = topicsByDomain[domain] ?? 0;
      const completedTopics = topicProgress.filter(
        (p) => p.domain === domain
      );
      const completed = completedTopics.length;

      const sessionsForDomain = allSessions.filter(
        (s) => s.domain === domain && s.quizScore != null && s.quizTotal != null
      );
      const avgScore =
        sessionsForDomain.length > 0
          ? sessionsForDomain.reduce(
              (sum, s) => sum + (s.quizScore! / s.quizTotal!) * 100,
              0
            ) / sessionsForDomain.length
          : 0;

      domainProgress[domain] = { total, completed, avgScore: Math.round(avgScore) };
    }

    const hasPerfectQuiz = allSessions.some(
      (s) =>
        s.quizScore != null &&
        s.quizTotal != null &&
        s.quizTotal > 0 &&
        s.quizScore === s.quizTotal
    );

    const badges = [
      {
        id: "first_session",
        name: "First Steps",
        description: "Complete your first training session",
        earned: stats.totalSessions >= 1,
      },
      {
        id: "ten_sessions",
        name: "Dedicated Learner",
        description: "Complete 10 training sessions",
        earned: stats.totalSessions >= 10,
      },
      {
        id: "fifty_sessions",
        name: "GRC Veteran",
        description: "Complete 50 training sessions",
        earned: stats.totalSessions >= 50,
      },
      {
        id: "week_streak",
        name: "Week Warrior",
        description: "Maintain a 7-day streak",
        earned: stats.longestStreak >= 7,
      },
      {
        id: "month_streak",
        name: "Monthly Master",
        description: "Maintain a 30-day streak",
        earned: stats.longestStreak >= 30,
      },
      {
        id: "perfect_quiz",
        name: "Perfect Score",
        description: "Score 100% on a quiz",
        earned: hasPerfectQuiz,
      },
      ...DOMAINS.map((domain) => {
        const dp = domainProgress[domain];
        return {
          id: `domain_complete_${domain.toLowerCase().replace(/[^a-z]/g, "_")}`,
          name: `${domain} Master`,
          description: `Complete all topics in ${domain}`,
          earned: dp ? dp.total > 0 && dp.completed >= dp.total : false,
        };
      }),
    ].map((b) => ({
      ...b,
      earnedDate: b.earned ? stats.lastSessionDate ?? undefined : undefined,
    }));

    return NextResponse.json({
      stats,
      domainProgress,
      topicProgress: topicProgress.map((tp) => ({
        topicId: tp.topicId,
        domain: tp.domain,
        topic: tp.topic,
        level: tp.level,
        timesStudied: tp.timesStudied,
        lastStudied: tp.lastStudied?.toISOString() ?? null,
        quizScores: tp.quizScores,
      })),
      allSessions,
      badges,
    });
  } catch (error) {
    console.error("Failed to fetch progress:", error);
    return NextResponse.json(
      { error: "Failed to fetch progress" },
      { status: 500 }
    );
  }
}
