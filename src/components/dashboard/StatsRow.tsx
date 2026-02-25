"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Flame, BookOpen, Target, Zap } from "lucide-react";
import { staggerContainer, fadeInUp } from "@/lib/animations";

interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalSessions: number;
  totalXp: number;
  currentLevel: number;
  lastSessionDate: string | null;
}

interface StatsRowProps {
  stats: UserStats;
  averageScore: number;
}

function useCountUp(end: number, duration = 1200) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    function step(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * end));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    }
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [end, duration]);

  return value;
}

function StatCard({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix?: string;
}) {
  const displayed = useCountUp(value);

  return (
    <motion.div
      variants={fadeInUp}
      className="glass-card rounded-xl p-5 flex flex-col gap-2"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="text-3xl font-bold tracking-tight">
        {displayed}
        {suffix && <span className="text-base font-normal text-muted-foreground ml-1">{suffix}</span>}
      </p>
    </motion.div>
  );
}

export function StatsRow({ stats, averageScore }: StatsRowProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      <StatCard icon={Flame} label="Current Streak" value={stats.currentStreak} suffix="days" />
      <StatCard icon={BookOpen} label="Sessions Completed" value={stats.totalSessions} />
      <StatCard icon={Target} label="Avg Quiz Score" value={averageScore} suffix="%" />
      <StatCard icon={Zap} label="XP / Level" value={stats.totalXp} suffix={`L${stats.currentLevel}`} />
    </motion.div>
  );
}
