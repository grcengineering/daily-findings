"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRightIcon,
  ArrowLeftIcon,
  GlobeIcon,
  MessageSquareIcon,
  ChevronDownIcon,
  CheckCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FlaggedClaimsWarning,
  SourcesFooter,
} from "./VerificationIndicator";
import { RichText } from "./RichText";

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

interface ScenarioContent {
  title: string;
  context: string;
  scenario: string;
  analysisQuestions: Array<{ question: string; analysis: string }>;
  citations?: Citation[];
  confidenceScore?: number;
  flaggedClaims?: FlaggedClaim[];
}

interface ScenarioViewProps {
  scenario: ScenarioContent;
  domainColor: string;
  onComplete: () => void;
}

type Step =
  | { kind: "context" }
  | { kind: "scenario" }
  | { kind: "question"; index: number }
  | { kind: "sources" };

export function ScenarioView({ scenario, domainColor, onComplete }: ScenarioViewProps) {
  const hasSources = scenario.citations && scenario.citations.length > 0;
  const steps: Step[] = [
    { kind: "context" },
    { kind: "scenario" },
    ...scenario.analysisQuestions.map((_, i) => ({ kind: "question" as const, index: i })),
    ...(hasSources ? [{ kind: "sources" as const }] : []),
  ];
  const totalSteps = steps.length;

  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [revealedAnswers, setRevealedAnswers] = useState<Set<number>>(new Set());

  const current = steps[stepIdx];

  const goNext = () => {
    if (stepIdx < totalSteps - 1) {
      setDirection(1);
      setStepIdx((s) => s + 1);
    }
  };

  const goPrev = () => {
    if (stepIdx > 0) {
      setDirection(-1);
      setStepIdx((s) => s - 1);
    }
  };

  const toggleAnswer = (idx: number) => {
    setRevealedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const isLast = stepIdx === totalSteps - 1;

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 60 : -60,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: { duration: 0.35, ease: "easeOut" as const },
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -60 : 60,
      opacity: 0,
      transition: { duration: 0.25 },
    }),
  };

  const stepLabel = (() => {
    if (current.kind === "context") return "Background";
    if (current.kind === "scenario") return "The Scenario";
    if (current.kind === "sources") return "Sources";
    return `Question ${current.index + 1} of ${scenario.analysisQuestions.length}`;
  })();

  return (
    <div className="max-w-[700px] mx-auto py-8 px-4 flex flex-col min-h-[calc(100vh-160px)]">
      {/* Top bar */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="secondary" className="gap-1.5">
            <GlobeIcon className="size-3" />
            Real-World Context
          </Badge>
          <Badge variant="outline">
            {stepIdx + 1} / {totalSteps}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{scenario.title}</h1>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mt-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                flex: i === stepIdx ? 3 : 1,
                backgroundColor: i <= stepIdx ? domainColor : "var(--border)",
              }}
            />
          ))}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 flex items-start">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={stepIdx}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="w-full"
          >
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              {stepLabel}
            </p>

            {current.kind === "context" && (
              <div className="glass-card rounded-xl p-6">
                <FlaggedClaimsWarning flaggedClaims={scenario.flaggedClaims} />
                <RichText text={scenario.context} />
              </div>
            )}

            {current.kind === "scenario" && (
              <div
                className="rounded-xl border-l-4 bg-muted/20 p-6"
                style={{ borderLeftColor: domainColor }}
              >
                <RichText text={scenario.scenario} />
              </div>
            )}

            {current.kind === "question" && (() => {
              const q = scenario.analysisQuestions[current.index];
              const isRevealed = revealedAnswers.has(current.index);
              return (
                <div>
                  <div className="glass-card rounded-xl p-6">
                    <div className="flex items-start gap-3 mb-4">
                      <span
                        className="flex items-center justify-center size-8 rounded-full text-sm font-bold text-white shrink-0"
                        style={{ backgroundColor: domainColor }}
                      >
                        {current.index + 1}
                      </span>
                      <p className="text-[16px] font-medium leading-relaxed pt-1">
                        {q.question}
                      </p>
                    </div>

                    <div className="ml-11">
                      {!isRevealed ? (
                        <Button
                          variant="outline"
                          onClick={() => toggleAnswer(current.index)}
                          className="gap-2"
                        >
                          <MessageSquareIcon className="size-4" />
                          Reveal Analysis
                          <ChevronDownIcon className="size-3" />
                        </Button>
                      ) : (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <CheckCircleIcon
                              className="size-4"
                              style={{ color: domainColor }}
                            />
                            <span
                              className="text-sm font-medium"
                              style={{ color: domainColor }}
                            >
                              Analysis
                            </span>
                          </div>
                          <div
                            className={cn(
                              "rounded-lg border-l-4 p-4 bg-muted/30"
                            )}
                            style={{ borderLeftColor: domainColor }}
                          >
                            <RichText text={q.analysis} className="text-sm [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm" />
                          </div>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {current.kind === "sources" && (
              <div className="glass-card rounded-xl p-6">
                <SourcesFooter citations={scenario.citations} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-6 pt-3 border-t border-border">
        <Button
          variant="ghost"
          onClick={goPrev}
          disabled={stepIdx === 0}
          className="gap-2"
        >
          <ArrowLeftIcon className="size-4" />
          Back
        </Button>

        {isLast ? (
          <Button size="lg" onClick={onComplete} className="gap-2">
            Continue to Quiz
            <ArrowRightIcon className="size-4" />
          </Button>
        ) : (
          <Button onClick={goNext} className="gap-2">
            Next
            <ArrowRightIcon className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
