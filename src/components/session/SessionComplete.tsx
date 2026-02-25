"use client";

import { useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fadeInUp, staggerContainer, popIn, scaleIn } from "@/lib/animations";
import { getDomainColor } from "@/lib/domain-colors";
import { TrophyIcon, FlameIcon, StarIcon, ArrowLeftIcon } from "lucide-react";
import confetti from "canvas-confetti";

interface SessionCompleteProps {
  domain: string;
  topic: string;
  quizScore: number;
  quizTotal: number;
  xpEarned: number;
  streak: number;
  level: number;
}

export function SessionComplete({
  domain,
  topic,
  quizScore,
  quizTotal,
  xpEarned,
  streak,
  level,
}: SessionCompleteProps) {
  const domainColor = getDomainColor(domain);
  const percentage = quizTotal > 0 ? Math.round((quizScore / quizTotal) * 100) : 0;

  useEffect(() => {
    let rafId: number;
    const end = Date.now() + 2000;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#6366f1", "#06b6d4", "#10b981", "#f59e0b"],
      });
      if (Date.now() < end) {
        rafId = requestAnimationFrame(frame);
      }
    };
    rafId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="max-w-[500px] mx-auto py-12 px-4 text-center"
    >
      <motion.div variants={popIn}>
        <TrophyIcon className="size-16 text-amber-500 mx-auto mb-4" />
      </motion.div>

      <motion.h1
        variants={fadeInUp}
        className="text-3xl font-bold gradient-text mb-2"
      >
        Session Complete!
      </motion.h1>
      <motion.p variants={fadeInUp} className="text-muted-foreground mb-8">
        Great work today. Keep the momentum going!
      </motion.p>

      <motion.div variants={scaleIn} className="glass-card rounded-xl p-6 mb-6">
        <Badge
          className="mb-3"
          style={{ backgroundColor: `${domainColor}20`, color: domainColor }}
        >
          {domain}
        </Badge>
        <p className="font-medium mb-4">{topic}</p>

        <div className="flex items-center justify-center gap-1 text-4xl font-bold mb-1">
          <span>{quizScore}</span>
          <span className="text-muted-foreground text-2xl">/</span>
          <span>{quizTotal}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {percentage}% quiz accuracy
        </p>
      </motion.div>

      <motion.div
        variants={fadeInUp}
        className="grid grid-cols-3 gap-3 mb-8"
      >
        <div className="glass-card rounded-xl p-4">
          <StarIcon className="size-5 text-indigo-500 mx-auto mb-1" />
          <p className="text-lg font-bold">+{xpEarned}</p>
          <p className="text-xs text-muted-foreground">XP Earned</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <FlameIcon className="size-5 text-orange-500 mx-auto mb-1" />
          <p className="text-lg font-bold">{streak}</p>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </div>
        <div className="glass-card rounded-xl p-4">
          <TrophyIcon className="size-5 text-amber-500 mx-auto mb-1" />
          <p className="text-lg font-bold">{level}</p>
          <p className="text-xs text-muted-foreground">Level</p>
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} className="space-y-3">
        <Button size="lg" asChild className="w-full gap-2">
          <Link href="/">
            <ArrowLeftIcon className="size-4" />
            Return to Dashboard
          </Link>
        </Button>
        <p className="text-sm text-muted-foreground">See you tomorrow!</p>
      </motion.div>
    </motion.div>
  );
}
