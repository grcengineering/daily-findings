"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftIcon } from "lucide-react";
import { slideInRight } from "@/lib/animations";
import { getDomainColor } from "@/lib/domain-colors";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionProgress } from "@/components/session/SessionProgress";
import { LessonView } from "@/components/session/LessonView";
import { ScenarioView } from "@/components/session/ScenarioView";
import { QuizView } from "@/components/session/QuizView";
import { SessionComplete } from "@/components/session/SessionComplete";
import { CapstoneSection } from "@/components/session/CapstoneSection";

interface Citation {
  url: string;
  title: string;
  citedText: string;
}

interface FlaggedClaim {
  claim: string;
  issue: string;
  suggestion: string;
  section: string;
}

interface LessonContent {
  title: string;
  estimatedReadingTime: number;
  introduction: string;
  sections: Array<{
    heading: string;
    content: string;
    keyTermCallout?: { term: string; definition: string };
  }>;
  keyTakeaways: string[];
  citations?: Citation[];
  flaggedClaims?: FlaggedClaim[];
}

interface ScenarioContent {
  title: string;
  context: string;
  scenario: string;
  analysisQuestions: Array<{ question: string; analysis: string }>;
  citations?: Citation[];
  flaggedClaims?: FlaggedClaim[];
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface QuizContent {
  questions: QuizQuestion[];
  citations?: Citation[];
  flaggedClaims?: FlaggedClaim[];
}

interface SessionData {
  id: string;
  topicId: string;
  domain: string;
  topic: string;
  level: string;
  moduleType: "core" | "depth" | "specialization" | "capstone";
  competencyIds: string[];
  prerequisites: string[];
  lesson: LessonContent;
  scenario: ScenarioContent;
  quiz: QuizContent;
  capstone?: {
    deliverable_prompt: string;
    deliverable_format: string;
    synthesis_questions: Array<{ question: string; guidance: string }>;
    scenario_decisions: Array<{
      situation: string;
      options: string[];
      best_option: string;
      rationale: string;
    }>;
    rubric: Array<{
      criterion: string;
      excellent: string;
      acceptable: string;
      needs_work: string;
    }>;
  } | null;
  completed: boolean;
  quizScore: number | null;
  quizTotal: number | null;
}

interface CompletionStats {
  totalXp: number;
  currentLevel: number;
  currentStreak: number;
}

function LoadingSkeleton() {
  return (
    <div className="max-w-[700px] mx-auto py-12 px-4 space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-3/4" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-4/6" />
      <div className="space-y-4 pt-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <p className="text-center text-sm text-muted-foreground pt-4">
        Generating your session&hellip; this may take a moment.
      </p>
    </div>
  );
}

function SessionPageContent() {
  const searchParams = useSearchParams();
  const topicId = searchParams.get("topicId");
  const overridePrereq = searchParams.get("overridePrereq");
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<number[]>([]);
  const [quizScore, setQuizScore] = useState(0);
  const [quizTotal, setQuizTotal] = useState(0);
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
  const sectionNames =
    session?.moduleType === "capstone"
      ? ["Lesson", "Scenario", "Quiz", "Capstone"]
      : ["Lesson", "Scenario", "Quiz"];

  useEffect(() => {
    async function load() {
      try {
        const url = topicId
          ? `/api/session/generate?topicId=${encodeURIComponent(topicId)}${
              overridePrereq === "1" ? "&overridePrereq=1" : ""
            }`
          : "/api/session/generate";
        const res = await fetch(url);
        if (!res.ok) {
          const errorPayload = await res.json().catch(() => null);
          throw new Error(
            errorPayload?.error ?? "Failed to load session"
          );
        }
        const data: SessionData = await res.json();
        setSession(data);

        if (data.completed) {
          setCompletedSections(
            data.moduleType === "capstone" ? [0, 1, 2, 3] : [0, 1, 2]
          );
          setSessionDone(true);
          setQuizScore(data.quizScore ?? 0);
          setQuizTotal(data.quizTotal ?? 0);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [overridePrereq, topicId]);

  const completeSection = useCallback(
    (sectionIdx: number) => {
      setCompletedSections((prev) =>
        prev.includes(sectionIdx) ? prev : [...prev, sectionIdx]
      );
      if (session?.moduleType === "capstone") {
        if (sectionIdx < 3) {
          setCurrentSection(sectionIdx + 1);
        }
      } else if (sectionIdx < 2) {
        setCurrentSection(sectionIdx + 1);
      }
    },
    [session]
  );

  const handleQuizComplete = useCallback(
    async (score: number, total: number) => {
      setQuizScore(score);
      setQuizTotal(total);
      setCompletedSections((prev) =>
        prev.includes(2) ? prev : [...prev, 2]
      );
      if (session?.moduleType === "capstone") {
        setCurrentSection(3);
      } else if (session) {
        setSessionDone(true);
        try {
          const res = await fetch("/api/session/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topicId: session.topicId,
              quizScore: score,
              quizTotal: total,
            }),
          });
          if (res.ok) {
            const stats: CompletionStats = await res.json();
            setCompletionStats(stats);
          }
        } catch {
          // Non-blocking — stats will refresh on next visit
        }
      }
    },
    [session]
  );

  const handleCapstoneComplete = useCallback(async () => {
    setCompletedSections((prev) => (prev.includes(3) ? prev : [...prev, 3]));
    if (session) {
      try {
        const res = await fetch("/api/session/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicId: session.topicId,
            quizScore,
            quizTotal,
          }),
        });
        if (res.ok) {
          const stats: CompletionStats = await res.json();
          setCompletionStats(stats);
        }
      } catch {
        // Non-blocking — stats will refresh on next visit
      }
    }
    setSessionDone(true);
  }, [quizScore, quizTotal, session]);

  const handleSectionClick = useCallback(
    (idx: number) => {
      if (completedSections.includes(idx) || idx === currentSection) {
        setCurrentSection(idx);
      }
    },
    [completedSections, currentSection]
  );

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="h-1.5 w-full bg-muted/40" />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Unable to load session</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-primary hover:underline text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const domainColor = getDomainColor(session.domain);
  const xpEarned = 100 + Math.round((quizScore / Math.max(quizTotal, 1)) * 50);

  if (sessionDone) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <SessionComplete
          domain={session.domain}
          topic={session.topic}
          quizScore={quizScore}
          quizTotal={quizTotal}
          xpEarned={xpEarned}
          streak={completionStats?.currentStreak ?? 1}
          level={completionStats?.currentLevel ?? 1}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top nav bar */}
      <div className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-background/80 backdrop-blur-xl border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="size-4" />
          <span className="hidden sm:inline">Back to Dashboard</span>
          <span className="sm:hidden">Back</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: domainColor }}
          />
          <span className="font-medium truncate max-w-[200px] sm:max-w-none">
            {session.topic}
          </span>
        </div>
      </div>

      <SessionProgress
        currentSection={currentSection}
        completedSections={completedSections}
        sectionNames={sectionNames}
        onSectionClick={handleSectionClick}
      />

      <AnimatePresence mode="wait">
        {currentSection === 0 && (
          <motion.div
            key="lesson"
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -30 }}
          >
            <LessonView
              lesson={session.lesson}
              domainColor={domainColor}
              onComplete={() => completeSection(0)}
            />
          </motion.div>
        )}

        {currentSection === 1 && (
          <motion.div
            key="scenario"
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -30 }}
          >
            <ScenarioView
              scenario={session.scenario}
              domainColor={domainColor}
              onComplete={() => completeSection(1)}
            />
          </motion.div>
        )}

        {currentSection === 2 && (
          <motion.div
            key="quiz"
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -30 }}
          >
            <QuizView
              quiz={session.quiz}
              onComplete={handleQuizComplete}
            />
          </motion.div>
        )}

        {currentSection === 3 && session.capstone && (
          <motion.div
            key="capstone"
            variants={slideInRight}
            initial="hidden"
            animate="visible"
            exit={{ opacity: 0, x: -30 }}
          >
            <CapstoneSection capstone={session.capstone} onComplete={handleCapstoneComplete} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <div className="h-1.5 w-full bg-muted/40" />
          <LoadingSkeleton />
        </div>
      }
    >
      <SessionPageContent />
    </Suspense>
  );
}
