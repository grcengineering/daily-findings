"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

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

interface WeeklyHeatmapProps {
  sessions: DailySession[];
}

const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""] as const;
const WEEKS = 12;

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function WeeklyHeatmap({ sessions }: WeeklyHeatmapProps) {
  const { grid, completedSet } = useMemo(() => {
    const set = new Set(
      sessions.filter((s) => s.completed).map((s) => s.date.slice(0, 10))
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayOfWeek = today.getDay();
    const endOfWeek = new Date(today);
    endOfWeek.setDate(today.getDate() + (6 - dayOfWeek));

    const totalDays = WEEKS * 7;
    const startDate = new Date(endOfWeek);
    startDate.setDate(endOfWeek.getDate() - totalDays + 1);

    const days: { date: Date; key: string }[] = [];
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push({ date: d, key: toDateKey(d) });
    }

    const columns: { date: Date; key: string }[][] = [];
    for (let w = 0; w < WEEKS; w++) {
      columns.push(days.slice(w * 7, (w + 1) * 7));
    }

    return { grid: columns, completedSet: set };
  }, [sessions]);

  const todayKey = toDateKey(new Date());

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      <h2 className="text-xl font-semibold mb-4">Activity</h2>
      <div className="glass-card rounded-xl p-5">
        <TooltipProvider>
          <div className="flex gap-1">
            <div className="flex flex-col gap-1 mr-1 pt-0">
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  className="h-3.5 w-6 text-[10px] leading-3.5 text-muted-foreground text-right"
                >
                  {label}
                </div>
              ))}
            </div>
            {grid.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map(({ key, date }) => {
                  const done = completedSet.has(key);
                  const isToday = key === todayKey;
                  const isFuture = date > new Date();
                  const formatted = date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });

                  return (
                    <Tooltip key={key}>
                      <TooltipTrigger asChild>
                        <div
                          className={`size-3.5 rounded-sm transition-colors ${
                            isFuture
                              ? "bg-transparent"
                              : done
                                ? "bg-indigo-500"
                                : "bg-muted-foreground/15"
                          } ${isToday ? "ring-1 ring-indigo-400" : ""}`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        {formatted} — {done ? "Completed" : isFuture ? "Upcoming" : "No session"}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </TooltipProvider>
      </div>
    </motion.div>
  );
}
