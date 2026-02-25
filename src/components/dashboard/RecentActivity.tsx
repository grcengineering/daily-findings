"use client";

import { motion } from "framer-motion";
import { staggerContainer, fadeInUp } from "@/lib/animations";
import { getDomainColor } from "@/lib/domain-colors";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

interface RecentActivityProps {
  sessions: DailySession[];
}

function relativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return `${diffDays} days ago`;
}

function scoreBadgeClass(pct: number): string {
  if (pct >= 80) return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
  if (pct >= 60) return "bg-amber-500/15 text-amber-500 border-amber-500/30";
  return "bg-red-500/15 text-red-500 border-red-500/30";
}

export function RecentActivity({ sessions }: RecentActivityProps) {
  const recent = sessions.slice(0, 5);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
      {recent.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          No sessions yet. Start your first one!
        </div>
      ) : (
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {recent.map((session) => {
            const color = getDomainColor(session.domain);
            const scorePct =
              session.quizScore != null && session.quizTotal
                ? Math.round((session.quizScore / session.quizTotal) * 100)
                : null;

            return (
              <motion.div
                key={session.id}
                variants={fadeInUp}
                className="glass-card rounded-lg px-4 py-3 flex items-center gap-3"
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{session.topic}</p>
                  <p className="text-xs text-muted-foreground">{session.domain}</p>
                </div>
                {scorePct != null && (
                  <Badge
                    variant="outline"
                    className={cn("text-xs", scoreBadgeClass(scorePct))}
                  >
                    {session.quizScore}/{session.quizTotal}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {relativeDate(session.date)}
                </span>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
