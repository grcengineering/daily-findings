"use client";

import { useEffect, useState } from "react";
import { PageTransition } from "@/components/layout/PageTransition";
import { HeroGreeting } from "@/components/dashboard/HeroGreeting";
import { StartSessionCTA } from "@/components/dashboard/StartSessionCTA";
import { StatsRow } from "@/components/dashboard/StatsRow";
import { DomainProgress } from "@/components/dashboard/DomainProgress";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { WeeklyHeatmap } from "@/components/dashboard/WeeklyHeatmap";
import { NewsFeed } from "@/components/dashboard/NewsFeed";
import { Skeleton } from "@/components/ui/skeleton";

interface NewsArticle {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  summary: string;
  image?: string;
}

interface FeedStatus {
  source: string;
  ok: boolean;
  count: number;
}

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  totalXp: number;
  currentLevel: number;
  lastSessionDate: string | null;
}

interface DailySession {
  id: string;
  date: string;
  domain: string;
  topic: string;
  level: string;
  completed: boolean;
  quizScore: number | null;
  quizTotal: number | null;
}

interface StatsData {
  stats: UserStats;
  recentSessions: DailySession[];
  domainProgress: Record<string, { total: number; completed: number }>;
}

interface SessionStatus {
  hasActiveSession: boolean;
  sessionCompleted: boolean;
}

interface NewsMeta {
  sourceStatus: FeedStatus[];
  lastUpdated: string | null;
  lastRefreshDurationMs: number | null;
  stale: boolean;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div>
        <Skeleton className="h-4 w-48 mb-2" />
        <Skeleton className="h-12 w-80" />
      </div>
      <Skeleton className="h-14 w-64 rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div>
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <Skeleton className="h-6 w-36 mb-4" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

function computeAverageScore(sessions: DailySession[]): number {
  const scored = sessions.filter((s) => s.quizScore != null && s.quizTotal);
  if (scored.length === 0) return 0;
  const total = scored.reduce(
    (sum, s) => sum + (s.quizScore! / s.quizTotal!) * 100,
    0
  );
  return Math.round(total / scored.length);
}

export default function DashboardPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [session, setSession] = useState<SessionStatus>({
    hasActiveSession: false,
    sessionCompleted: false,
  });
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [newsMeta, setNewsMeta] = useState<NewsMeta>({
    sourceStatus: [],
    lastUpdated: null,
    lastRefreshDurationMs: null,
    stale: false,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, sessionRes] = await Promise.all([
          fetch("/api/stats"),
          fetch("/api/session/today"),
        ]);
        if (statsRes.ok) {
          setData(await statsRes.json());
        }
        if (sessionRes.ok) {
          const todayData = await sessionRes.json();
          setSession({
            hasActiveSession: todayData.session != null,
            sessionCompleted: todayData.session?.completed ?? false,
          });
        }
      } catch {
        // API not available yet — will show skeleton then empty state
      } finally {
        setLoading(false);
      }
    }
    load();

    fetch("/api/news")
      .then((r) =>
        r.ok
          ? r.json()
          : {
              articles: [],
              sourceStatus: [],
              lastUpdated: null,
              lastRefreshDurationMs: null,
              stale: true,
            }
      )
      .then((d) => {
        setNewsArticles(d.articles ?? []);
        setNewsMeta({
          sourceStatus: d.sourceStatus ?? [],
          lastUpdated: d.lastUpdated ?? null,
          lastRefreshDurationMs: d.lastRefreshDurationMs ?? null,
          stale: Boolean(d.stale),
        });
      })
      .catch(() => {});
  }, []);

  const stats = data?.stats ?? {
    currentStreak: 0,
    longestStreak: 0,
    totalSessions: 0,
    totalXp: 0,
    currentLevel: 1,
    lastSessionDate: null,
  };

  const sessions = data?.recentSessions ?? [];
  const domainProgress = data?.domainProgress ?? {};
  const avgScore = computeAverageScore(sessions);

  return (
    <PageTransition>
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <div className="space-y-10">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <HeroGreeting streak={stats.currentStreak} />
              <StartSessionCTA
                hasActiveSession={session.hasActiveSession}
                sessionCompleted={session.sessionCompleted}
              />
            </div>

            <StatsRow stats={stats} averageScore={avgScore} />

            <DomainProgress progress={domainProgress} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <RecentActivity sessions={sessions} />
              <WeeklyHeatmap sessions={sessions} />
            </div>

            <NewsFeed
              articles={newsArticles.slice(0, 8)}
              sourceStatus={newsMeta.sourceStatus}
              lastUpdated={newsMeta.lastUpdated}
              lastRefreshDurationMs={newsMeta.lastRefreshDurationMs}
              stale={newsMeta.stale}
            />
          </div>
        )}
      </div>
    </PageTransition>
  );
}
