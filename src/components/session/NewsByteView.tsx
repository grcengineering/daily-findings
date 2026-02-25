"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NewspaperIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  InfoIcon,
  ExternalLinkIcon,
} from "lucide-react";
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

interface NewsByteContent {
  headline: string;
  summary: string;
  updates: Array<{ title: string; content: string; source: string }>;
  whyItMatters: string;
  citations?: Citation[];
  confidenceScore?: number;
  flaggedClaims?: FlaggedClaim[];
}

interface NewsByteViewProps {
  newsByte: NewsByteContent;
  onComplete: () => void;
}

type Step =
  | { kind: "summary" }
  | { kind: "update"; index: number }
  | { kind: "whyItMatters" }
  | { kind: "sources" };

export function NewsByteView({ newsByte, onComplete }: NewsByteViewProps) {
  const hasSources = newsByte.citations && newsByte.citations.length > 0;
  const steps: Step[] = [
    { kind: "summary" },
    ...newsByte.updates.map((_, i) => ({ kind: "update" as const, index: i })),
    { kind: "whyItMatters" },
    ...(hasSources ? [{ kind: "sources" as const }] : []),
  ];
  const totalSteps = steps.length;

  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);

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
    if (current.kind === "summary") return "Overview";
    if (current.kind === "update")
      return `Update ${current.index + 1} of ${newsByte.updates.length}`;
    if (current.kind === "sources") return "Sources";
    return "Why This Matters";
  })();

  return (
    <div className="max-w-[700px] mx-auto py-8 px-4 flex flex-col min-h-[calc(100vh-80px)]">
      {/* Top bar */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <Badge variant="secondary" className="gap-1.5">
            <NewspaperIcon className="size-3" />
            Industry Briefing
          </Badge>
          <Badge variant="outline">
            {stepIdx + 1} / {totalSteps}
          </Badge>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{newsByte.headline}</h1>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mt-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                flex: i === stepIdx ? 3 : 1,
                backgroundColor:
                  i <= stepIdx
                    ? "var(--color-primary)"
                    : "var(--border)",
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

            {current.kind === "summary" && (
              <div className="glass-card rounded-xl p-6">
                <FlaggedClaimsWarning flaggedClaims={newsByte.flaggedClaims} />
                <RichText text={newsByte.summary} className="[&_p]:text-lg [&_p]:leading-relaxed" />
              </div>
            )}

            {current.kind === "update" && (() => {
              const update = newsByte.updates[current.index];
              return (
                <div className="glass-card rounded-xl p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <h3 className="text-lg font-semibold">{update.title}</h3>
                    <Badge variant="outline" className="text-xs gap-1 shrink-0">
                      <ExternalLinkIcon className="size-2.5" />
                      {update.source}
                    </Badge>
                  </div>
                  <RichText text={update.content} />
                </div>
              );
            })()}

            {current.kind === "whyItMatters" && (
              <div className="rounded-xl p-6 border-l-4 border-l-primary bg-primary/5">
                <div className="flex items-center gap-2 mb-4">
                  <InfoIcon className="size-5 text-primary" />
                  <h3 className="font-semibold text-lg">Why This Matters</h3>
                </div>
                <RichText text={newsByte.whyItMatters} />
              </div>
            )}

            {current.kind === "sources" && (
              <div className="glass-card rounded-xl p-6">
                <SourcesFooter citations={newsByte.citations} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-4 border-t border-border">
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
            Complete Session
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
