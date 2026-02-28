"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Play } from "lucide-react";
import { fadeInUp, pulseGlow } from "@/lib/animations";
import { cn } from "@/lib/utils";

interface StartSessionCTAProps {
  hasActiveSession: boolean;
  sessionCompleted: boolean;
  recommendationReason?: string | null;
  selectedPathTitle?: string | null;
}

export function StartSessionCTA({
  hasActiveSession,
  sessionCompleted,
  recommendationReason,
  selectedPathTitle,
}: StartSessionCTAProps) {
  const isNew = !hasActiveSession && !sessionCompleted;
  const isContinue = hasActiveSession && !sessionCompleted;
  const isDone = sessionCompleted;

  const label = isDone
    ? "Session Complete"
    : isContinue
      ? "Continue Session"
      : "Start Today's Session";

  const Icon = isDone ? CheckCircle2 : isContinue ? Play : ArrowRight;

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible">
      {selectedPathTitle ? (
        <p className="text-xs text-muted-foreground mb-2">
          Active path: <span className="text-foreground font-medium">{selectedPathTitle}</span>
        </p>
      ) : null}
      {isDone ? (
        <div
          className={cn(
            "relative inline-flex items-center gap-3 rounded-xl px-8 py-4 text-lg font-semibold",
            "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default"
          )}
        >
          <Icon className="size-5" />
          {label}
        </div>
      ) : (
        <>
          <Link href="/session">
            <motion.div
              className={cn(
                "relative inline-flex items-center gap-3 rounded-xl px-8 py-4 text-lg font-semibold text-white",
                "bg-gradient-to-r from-indigo-500 to-cyan-500",
                "hover:from-indigo-600 hover:to-cyan-600 transition-colors cursor-pointer"
              )}
              {...(isNew ? pulseGlow : {})}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <Icon className="size-5" />
              {label}
            </motion.div>
          </Link>
          {recommendationReason ? (
            <p className="mt-2 max-w-[420px] text-xs text-muted-foreground">
              Why this module: {recommendationReason}
            </p>
          ) : null}
        </>
      )}
    </motion.div>
  );
}
