"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PageTransition } from "@/components/layout/PageTransition";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DOMAIN_CONFIG, DOMAINS, type Domain } from "@/lib/domain-colors";
import { fadeInUp, staggerContainer } from "@/lib/animations";

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

export default function HistoryPage() {
  const [sessions, setSessions] = useState<DailySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/progress")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch history");
        return r.json();
      })
      .then((d) => setSessions(d.allSessions ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const matchesSearch =
        !search || s.topic.toLowerCase().includes(search.toLowerCase());
      const matchesDomain = domainFilter === "all" || s.domain === domainFilter;
      return matchesSearch && matchesDomain;
    });
  }, [sessions, search, domainFilter]);

  if (loading) return <HistorySkeleton />;

  return (
    <PageTransition>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Session History</h1>
          <p className="text-muted-foreground mt-1">
            Review your past training sessions and quiz results
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by topic..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
            />
          </div>
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="px-4 py-2.5 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-shadow"
          >
            <option value="all">All Domains</option>
            {DOMAINS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {/* Session List */}
        {filtered.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                  />
                </svg>
              </div>
              <h3 className="font-medium text-lg">No sessions found</h3>
              <p className="text-muted-foreground text-sm mt-1">
                {sessions.length === 0
                  ? "Start your first training session to begin building your history"
                  : "Try adjusting your search or filter"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {filtered.map((session) => {
              const config = DOMAIN_CONFIG[session.domain as Domain];
              const scorePct =
                session.quizScore != null && session.quizTotal != null && session.quizTotal > 0
                  ? Math.round((session.quizScore / session.quizTotal) * 100)
                  : null;
              const isExpanded = expandedId === session.id;

              return (
                <motion.div key={session.id} variants={fadeInUp}>
                  <Card
                    className={cn(
                      "glass-card cursor-pointer transition-all hover:border-primary/20",
                      isExpanded && "border-primary/30"
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  >
                    <CardContent className="py-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        {/* Date */}
                        <div className="text-sm text-muted-foreground w-24 shrink-0">
                          {new Date(session.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </div>

                        {/* Domain Badge */}
                        <Badge
                          variant="outline"
                          className="w-fit text-xs px-2 py-0.5 border-transparent"
                          style={{
                            backgroundColor: config ? `${config.color}15` : undefined,
                            color: config?.color,
                          }}
                        >
                          {session.domain}
                        </Badge>

                        {/* Topic */}
                        <span className="text-sm font-medium flex-1 min-w-0 truncate">
                          {session.topic}
                        </span>

                        {/* Right-side badges */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="secondary" className="text-[10px]">
                            {session.level}
                          </Badge>

                          {scorePct !== null && (
                            <Badge
                              className={cn(
                                "text-[10px] text-white",
                                scorePct >= 80
                                  ? "bg-emerald-500 hover:bg-emerald-600"
                                  : scorePct >= 60
                                    ? "bg-amber-500 hover:bg-amber-600"
                                    : "bg-red-500 hover:bg-red-600"
                              )}
                            >
                              {scorePct}%
                            </Badge>
                          )}

                          {session.completed ? (
                            <svg
                              className="w-5 h-5 text-emerald-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-5 h-5 text-muted-foreground"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <circle cx="12" cy="12" r="10" />
                            </svg>
                          )}

                          <svg
                            className={cn(
                              "w-4 h-4 text-muted-foreground transition-transform duration-200",
                              isExpanded && "rotate-180"
                            )}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {/* Expanded Detail */}
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-4 pt-4 border-t border-border"
                        >
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground block text-xs">Domain</span>
                              <span className="font-medium">{session.domain}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Level</span>
                              <span className="font-medium capitalize">{session.level}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Quiz</span>
                              <span className="font-medium">
                                {session.quizScore != null && session.quizTotal != null
                                  ? `${session.quizScore}/${session.quizTotal}`
                                  : "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-xs">Status</span>
                              <span className="font-medium">
                                {session.completed ? "Completed" : "Incomplete"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mt-3">
                            Use the Open Module action to review this topic again with full content.
                          </p>
                          <div className="mt-3">
                            <Link
                              href={`/session?topicId=${encodeURIComponent(session.topicId)}&from=history&overridePrereq=1`}
                              className="inline-flex items-center rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors"
                            >
                              Open Module
                            </Link>
                          </div>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </PageTransition>
  );
}

function HistorySkeleton() {
  return (
    <PageTransition>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
        <div>
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-5 w-80 mt-2" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-11 flex-1" />
          <Skeleton className="h-11 w-48" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
