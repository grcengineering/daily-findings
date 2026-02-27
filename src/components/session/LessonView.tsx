"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClockIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  LightbulbIcon,
  BookOpenIcon,
  ExpandIcon,
} from "lucide-react";
import {
  FlaggedClaimsWarning,
  SourcesFooter,
} from "./VerificationIndicator";
import { RichText } from "./RichText";
import { cn } from "@/lib/utils";

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

interface LessonSection {
  heading: string;
  content: string;
  keyTermCallout?: { term: string; definition: string };
}

interface LessonContent {
  title: string;
  estimatedReadingTime: number;
  introduction: string;
  sections: LessonSection[];
  keyTakeaways: string[];
  citations?: Citation[];
  flaggedClaims?: FlaggedClaim[];
}

interface LessonViewProps {
  lesson: LessonContent;
  domainColor: string;
  onComplete: () => void;
}

type Step =
  | { kind: "intro" }
  | { kind: "section"; index: number }
  | { kind: "takeaways" }
  | { kind: "sources" };

export function LessonView({ lesson, domainColor, onComplete }: LessonViewProps) {
  const hasSources = lesson.citations && lesson.citations.length > 0;
  const totalSteps =
    1 + lesson.sections.length + 1 + (hasSources ? 1 : 0); // intro + sections + takeaways + sources
  const [stepIdx, setStepIdx] = useState(0);
  const [direction, setDirection] = useState(1);
  const [enlarged, setEnlarged] = useState(false);

  const steps: Step[] = [
    { kind: "intro" },
    ...lesson.sections.map((_, i) => ({ kind: "section" as const, index: i })),
    { kind: "takeaways" },
    ...(hasSources ? [{ kind: "sources" as const }] : []),
  ];

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

  return (
    <div
      className={cn(
        "mx-auto py-8 px-4 flex flex-col min-h-[calc(100vh-160px)] transition-[max-width]",
        enlarged ? "max-w-[980px]" : "max-w-[700px]"
      )}
    >
      {/* Top bar: title + progress */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Badge variant="secondary" className="gap-1.5">
            <ClockIcon className="size-3" />
            {lesson.estimatedReadingTime} min
          </Badge>
          <Badge variant="outline" className="gap-1.5">
            <BookOpenIcon className="size-3" />
            {stepIdx + 1} / {totalSteps}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEnlarged((value) => !value)}
            className="gap-1 ml-auto"
            aria-label="Enlarge lesson content"
          >
            <ExpandIcon className="size-3.5" />
            {enlarged ? "Normal size" : "Enlarge"}
          </Button>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{lesson.title}</h1>

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
            {current.kind === "intro" && (
              <div className="glass-card rounded-xl p-6">
                <FlaggedClaimsWarning flaggedClaims={lesson.flaggedClaims} />
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                  Introduction
                </p>
                <RichText text={lesson.introduction} />
              </div>
            )}

            {current.kind === "section" && (() => {
              const section = lesson.sections[current.index];
              return (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <span
                      className="flex items-center justify-center size-8 rounded-full text-sm font-bold text-white shrink-0"
                      style={{ backgroundColor: domainColor }}
                    >
                      {current.index + 1}
                    </span>
                    <h2 className="text-xl font-semibold">{section.heading}</h2>
                  </div>

                  <div className="glass-card rounded-xl p-6">
                    <RichText text={section.content} />
                  </div>

                  {section.keyTermCallout && (
                    <div
                      className="mt-4 rounded-xl border-l-4 p-5 bg-muted/30"
                      style={{ borderLeftColor: domainColor }}
                    >
                      <p
                        className="text-sm font-bold mb-1"
                        style={{ color: domainColor }}
                      >
                        {section.keyTermCallout.term}
                      </p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {section.keyTermCallout.definition}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

            {current.kind === "takeaways" && (
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <LightbulbIcon className="size-5 text-amber-500" />
                  <h3 className="font-semibold text-lg">Key Takeaways</h3>
                </div>
                <div className="space-y-4">
                  {lesson.keyTakeaways.map((takeaway, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 text-[15px] text-muted-foreground"
                    >
                      <span
                        className="flex items-center justify-center size-6 rounded-full text-xs font-bold text-white shrink-0 mt-0.5"
                        style={{ backgroundColor: domainColor }}
                      >
                        {i + 1}
                      </span>
                      <RichText text={takeaway} className="leading-relaxed [&_p]:mb-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {current.kind === "sources" && (
              <div className="glass-card rounded-xl p-6">
                <SourcesFooter citations={lesson.citations} />
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
            Continue to Scenario
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
