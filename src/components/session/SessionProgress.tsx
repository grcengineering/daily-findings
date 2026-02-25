"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { popIn } from "@/lib/animations";
import { CheckIcon } from "lucide-react";

const SECTION_NAMES = ["Lesson", "Scenario", "Quiz"];

interface SessionProgressProps {
  currentSection: number;
  completedSections: number[];
  onSectionClick: (idx: number) => void;
}

export function SessionProgress({
  currentSection,
  completedSections,
  onSectionClick,
}: SessionProgressProps) {
  const progressPercent = (completedSections.length / SECTION_NAMES.length) * 100;

  return (
    <div className="w-full">
      <div className="h-1.5 w-full bg-muted/40 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>

      <div className="flex items-center justify-center gap-2 sm:gap-3 py-4 px-4">
        {SECTION_NAMES.map((name, idx) => {
          const isCompleted = completedSections.includes(idx);
          const isCurrent = idx === currentSection;
          const isClickable = isCompleted || isCurrent;

          return (
            <button
              key={name}
              disabled={!isClickable}
              onClick={() => onSectionClick(idx)}
              className={cn(
                "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium transition-all",
                isCurrent &&
                  "bg-primary text-primary-foreground shadow-md",
                isCompleted &&
                  !isCurrent &&
                  "bg-primary/10 text-primary hover:bg-primary/20",
                !isCompleted &&
                  !isCurrent &&
                  "bg-muted/50 text-muted-foreground cursor-not-allowed opacity-60"
              )}
            >
              {isCompleted && (
                <motion.span
                  variants={popIn}
                  initial="hidden"
                  animate="visible"
                  className="inline-flex"
                >
                  <CheckIcon className="size-3.5" />
                </motion.span>
              )}
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
