"use client";

import { motion } from "framer-motion";
import { staggerContainer, fadeInUp } from "@/lib/animations";
import { DOMAINS, DOMAIN_CONFIG, type Domain } from "@/lib/domain-colors";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface DomainProgressProps {
  progress: Record<string, { total: number; completed: number }>;
}

function CircularProgress({
  percentage,
  color,
  size = 80,
  strokeWidth = 6,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted/40"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
      />
    </svg>
  );
}

export function DomainProgress({ progress }: DomainProgressProps) {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Domain Progress</h2>
      <TooltipProvider>
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4"
        >
          {DOMAINS.map((domain) => {
            const config = DOMAIN_CONFIG[domain];
            const data = progress[domain] ?? { total: 0, completed: 0 };
            const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
            const remaining = data.total - data.completed;

            return (
              <Tooltip key={domain}>
                <TooltipTrigger asChild>
                  <motion.div
                    variants={fadeInUp}
                    className="glass-card rounded-xl p-4 flex flex-col items-center gap-3 cursor-default hover:border-white/20 transition-colors"
                  >
                    <div className="relative">
                      <CircularProgress percentage={pct} color={config.color} />
                      <span className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                        {pct}%
                      </span>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium leading-tight">{domain}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {data.completed}/{data.total} topics
                      </p>
                    </div>
                  </motion.div>
                </TooltipTrigger>
                <TooltipContent>
                  {remaining > 0
                    ? `${remaining} topic${remaining !== 1 ? "s" : ""} remaining`
                    : "All topics complete!"}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </motion.div>
      </TooltipProvider>
    </div>
  );
}
