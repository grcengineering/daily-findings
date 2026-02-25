"use client";

import { motion } from "framer-motion";
import { fadeInUp } from "@/lib/animations";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatDate(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

interface HeroGreetingProps {
  streak: number;
}

export function HeroGreeting({ streak }: HeroGreetingProps) {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      <p className="text-sm text-muted-foreground mb-1">{formatDate()}</p>
      <div className="flex items-center gap-4">
        <h1 className="text-4xl md:text-5xl font-bold gradient-text leading-tight overflow-visible pt-1">
          {getGreeting()}
        </h1>
        {streak > 0 && (
          <motion.div
            className="flex items-center gap-1.5 text-amber-500"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.3 }}
          >
            <span className="text-2xl" role="img" aria-label="streak">
              🔥
            </span>
            <span className="text-2xl font-bold">{streak}</span>
            <span className="text-sm text-muted-foreground">day streak</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
