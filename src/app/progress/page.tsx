"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts";
import { PageTransition } from "@/components/layout/PageTransition";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { DOMAIN_CONFIG, DOMAINS, type Domain } from "@/lib/domain-colors";
import { fadeInUp, staggerContainer } from "@/lib/animations";

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
  topicId: string;
  level: string;
  completed: boolean;
  quizScore: number | null;
  quizTotal: number | null;
}

interface TopicProgress {
  topicId: string;
  domain: string;
  topic: string;
  level: string;
  timesStudied: number;
  lastStudied: string | null;
  quizScores: string;
}

interface BadgeData {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  earnedDate?: string;
}

interface ProgressData {
  stats: UserStats;
  domainProgress: Record<string, { total: number; completed: number; avgScore: number }>;
  topicProgress: TopicProgress[];
  allSessions: DailySession[];
  badges: BadgeData[];
}

const DOMAIN_SHORT_NAMES: Record<string, string> = {
  "Frameworks & Standards": "Frameworks",
  "Risk Management": "Risk Mgmt",
  "Compliance & Regulatory": "Compliance",
  "Audit & Assurance": "Audit",
  "Policy & Governance": "Policy",
  "Incident Response & BCM": "Incident Resp.",
  "Third-Party Risk": "3rd Party",
};

const BADGE_ICONS: Record<string, string> = {
  first_session: "🎯",
  ten_sessions: "📚",
  fifty_sessions: "🏆",
  week_streak: "🔥",
  month_streak: "⚡",
  perfect_quiz: "💯",
};

export default function ProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch progress");
        return r.json();
      })
      .then((d) => {
        if (d.allSessions && d.domainProgress && d.badges) {
          setData(d);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ProgressSkeleton />;
  if (!data) {
    return (
      <PageTransition>
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <p className="text-muted-foreground">Failed to load progress data.</p>
        </div>
      </PageTransition>
    );
  }

  const radarData = DOMAINS.map((domain) => {
    const dp = data.domainProgress[domain];
    const pct = dp && dp.total > 0 ? Math.round((dp.completed / dp.total) * 100) : 0;
    return {
      domain: DOMAIN_SHORT_NAMES[domain] ?? domain,
      completion: pct,
      fullMark: 100,
    };
  });

  const quizSessions = data.allSessions
    .filter((s) => s.quizScore != null && s.quizTotal != null && s.quizTotal > 0)
    .reverse();

  const quizTrendData = quizSessions.map((s) => ({
    date: new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    score: Math.round((s.quizScore! / s.quizTotal!) * 100),
  }));

  const topicsByDomain = data.topicProgress.reduce<Record<string, TopicProgress[]>>(
    (acc, tp) => {
      (acc[tp.domain] ??= []).push(tp);
      return acc;
    },
    {}
  );

  return (
    <PageTransition>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Your Progress</h1>
          <p className="text-muted-foreground mt-1">
            Track your GRC learning journey across all domains
          </p>
        </div>

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* Radar Chart */}
          <motion.div variants={fadeInUp}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Domain Coverage</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="55%">
                    <PolarGrid stroke="var(--border)" />
                    <PolarAngleAxis
                      dataKey="domain"
                      tick={{ fontSize: 13, fill: "var(--foreground)", fontWeight: 600 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <Radar
                      name="Completion"
                      dataKey="completion"
                      stroke="#818cf8"
                      fill="#6366f1"
                      fillOpacity={0.35}
                      strokeWidth={2.5}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: "13px",
                        color: "var(--foreground)",
                      }}
                      formatter={(value?: number) => [`${value ?? 0}%`, "Completion"]}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>

          {/* Quiz Score Trend */}
          <motion.div variants={fadeInUp}>
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Quiz Score Trend</CardTitle>
              </CardHeader>
              <CardContent>
                {quizTrendData.length === 0 ? (
                  <div className="flex items-center justify-center h-[350px] text-muted-foreground text-sm">
                    Complete quizzes to see your score trend
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={350}>
                    <LineChart data={quizTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "13px",
                          color: "var(--foreground)",
                        }}
                        formatter={(value?: number) => [`${value ?? 0}%`, "Score"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="url(#scoreGradient)"
                        strokeWidth={2.5}
                        dot={{ fill: "#6366f1", r: 4, strokeWidth: 0 }}
                        activeDot={{ r: 6, fill: "#6366f1" }}
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Domain Breakdown */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Domain Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {DOMAINS.map((domain) => {
                  const dp = data.domainProgress[domain];
                  const config = DOMAIN_CONFIG[domain as Domain];
                  const pct = dp && dp.total > 0 ? Math.round((dp.completed / dp.total) * 100) : 0;
                  const topics = topicsByDomain[domain] ?? [];

                  return (
                    <AccordionItem key={domain} value={domain}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 flex-1">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: config?.color ?? "#6366f1" }}
                          />
                          <span className="font-medium text-sm">{domain}</span>
                          <div className="ml-auto flex items-center gap-4 mr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-28 h-2.5 rounded-full bg-muted border border-border overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${pct}%`,
                                    backgroundColor: config?.color ?? "#6366f1",
                                  }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-16 text-right">
                                {dp?.completed ?? 0}/{dp?.total ?? 0} topics
                              </span>
                            </div>
                            {dp && dp.avgScore > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                Avg: {dp.avgScore}%
                              </Badge>
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        {topics.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-2 pl-6">
                            No topics studied yet in this domain
                          </p>
                        ) : (
                          <div className="space-y-2 pl-6">
                            {topics.map((tp) => {
                              const scores: number[] = JSON.parse(tp.quizScores || "[]");
                              const lastScore = scores.length > 0 ? scores[scores.length - 1] : null;
                              return (
                                <div
                                  key={tp.topicId}
                                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span className="text-sm">{tp.topic}</span>
                                    <Badge variant="outline" className="text-[10px] px-1.5">
                                      {tp.level}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                    {lastScore !== null && (
                                      <span>Last score: {lastScore}%</span>
                                    )}
                                    <span>Studied {tp.timesStudied}x</span>
                                    {tp.lastStudied && (
                                      <span>
                                        {new Date(tp.lastStudied).toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>
        </motion.div>

        {/* Badges Grid */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg">Badges</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {data.badges.map((badge) => (
                  <motion.div key={badge.id} variants={fadeInUp}>
                    <div
                      className={cn(
                        "relative rounded-xl border p-4 transition-all",
                        badge.earned
                          ? "glass-card border-primary/20"
                          : "bg-muted/20 border-muted opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0",
                            badge.earned ? "bg-primary/10" : "bg-muted"
                          )}
                        >
                          {badge.earned ? (
                            BADGE_ICONS[badge.id] ?? "🏅"
                          ) : (
                            <svg
                              className="w-5 h-5 text-muted-foreground"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-sm truncate">{badge.name}</h3>
                            {badge.earned && (
                              <svg
                                className="w-4 h-4 text-emerald-500 shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {badge.description}
                          </p>
                          {badge.earned && badge.earnedDate && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              Earned {new Date(badge.earnedDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </PageTransition>
  );
}

function ProgressSkeleton() {
  return (
    <PageTransition>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
        <div>
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-72 mt-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[400px] rounded-xl" />
          <Skeleton className="h-[400px] rounded-xl" />
        </div>
        <Skeleton className="h-[300px] rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
