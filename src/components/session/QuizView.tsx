"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fadeInUp, slideInRight, popIn, shake } from "@/lib/animations";
import { CheckIcon, XIcon, ArrowRightIcon, TrophyIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";
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
  confidenceScore?: number;
  flaggedClaims?: FlaggedClaim[];
}

interface QuizViewProps {
  quiz: QuizContent;
  onComplete: (score: number, total: number) => void;
}

type AnswerRecord = {
  selectedIndex: number;
  correct: boolean;
};

export function QuizView({ quiz, onComplete }: QuizViewProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<Map<number, AnswerRecord>>(new Map());
  const [showResults, setShowResults] = useState(false);

  const questions = quiz?.questions ?? [];
  const total = questions.length;
  const current = questions[currentIdx];
  const score = Array.from(answers.values()).filter((a) => a.correct).length;

  if (total === 0) {
    return (
      <div className="max-w-[700px] mx-auto py-8 px-4 text-center">
        <p className="text-muted-foreground mb-4">No quiz questions available for this session.</p>
        <Button onClick={() => onComplete(0, 0)}>Skip Quiz</Button>
      </div>
    );
  }

  const fireConfetti = useCallback(() => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#6366f1", "#06b6d4", "#10b981"],
    });
  }, []);

  const handleSelect = (optionIdx: number) => {
    if (answered) return;

    setSelectedOption(optionIdx);
    setAnswered(true);

    const correct = optionIdx === current.correctIndex;
    setAnswers((prev) => {
      const next = new Map(prev);
      next.set(currentIdx, { selectedIndex: optionIdx, correct });
      return next;
    });

    if (correct) fireConfetti();
  };

  const handleNext = () => {
    if (currentIdx < total - 1) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedOption(null);
      setAnswered(false);
    } else {
      setShowResults(true);
    }
  };

  const handleFinish = () => {
    onComplete(score, total);
  };

  if (showResults) {
    return (
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="max-w-[700px] mx-auto py-8 px-4"
      >
        <div className="text-center mb-8">
          <TrophyIcon className="size-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Quiz Complete</h2>
          <p className="text-4xl font-bold gradient-text">
            {score} / {total}
          </p>
          <p className="text-muted-foreground mt-1">
            {Math.round((score / total) * 100)}% correct
          </p>
        </div>

        <div className="space-y-4 mb-8">
          {questions.map((q, i) => {
            const answer = answers.get(i);
            return (
              <div
                key={q.id}
                className={cn(
                  "glass-card rounded-xl p-4 border-l-4",
                  answer?.correct ? "border-l-emerald-500" : "border-l-red-500"
                )}
              >
                <div className="flex items-start gap-2 mb-2">
                  {answer?.correct ? (
                    <CheckIcon className="size-5 text-emerald-500 mt-0.5 shrink-0" />
                  ) : (
                    <XIcon className="size-5 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <p className="font-medium text-sm">{q.question}</p>
                </div>
                {!answer?.correct && (
                  <p className="text-xs text-muted-foreground ml-7 mb-1">
                    Correct answer: {q.options[q.correctIndex]}
                  </p>
                )}
                <div className="ml-7">
                  <RichText text={q.explanation} className="text-xs [&_p]:text-xs [&_p]:leading-relaxed [&_li]:text-xs [&_p]:mb-1" />
                </div>
              </div>
            );
          })}
        </div>

        <FlaggedClaimsWarning flaggedClaims={quiz.flaggedClaims} />
        <SourcesFooter citations={quiz.citations} />

        <div className="flex justify-end mt-6">
          <Button size="lg" onClick={handleFinish} className="gap-2">
            Complete Session
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="max-w-[700px] mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            Question {currentIdx + 1} of {total}
          </Badge>
        </div>
        <Badge variant="outline" className="gap-1">
          <TrophyIcon className="size-3" />
          {score} / {total}
        </Badge>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIdx}
          variants={slideInRight}
          initial="hidden"
          animate="visible"
          exit={{ opacity: 0, x: -30 }}
        >
          <h2 className="text-xl font-semibold mb-6">{current.question}</h2>

          <div className="space-y-3 mb-6">
            {current.options.map((option, optIdx) => {
              const isSelected = selectedOption === optIdx;
              const isCorrect = optIdx === current.correctIndex;
              const showCorrect = answered && isCorrect;
              const showIncorrect = answered && isSelected && !isCorrect;

              return (
                <motion.div
                  key={optIdx}
                  variants={showIncorrect ? shake : undefined}
                  initial={showIncorrect ? "idle" : undefined}
                  animate={showIncorrect ? "shake" : undefined}
                  whileHover={!answered ? { scale: 1.01 } : undefined}
                  whileTap={!answered ? { scale: 0.99 } : undefined}
                >
                  <button
                    disabled={answered}
                    onClick={() => handleSelect(optIdx)}
                    className={cn(
                      "w-full text-left rounded-xl p-4 border-2 transition-colors",
                      !answered &&
                        "border-border hover:border-primary/50 hover:bg-primary/5 cursor-pointer",
                      answered && !showCorrect && !showIncorrect && "border-border opacity-50",
                      showCorrect && "border-emerald-500 bg-emerald-500/10",
                      showIncorrect && "border-red-500 bg-red-500/10"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex items-center justify-center size-7 rounded-full text-xs font-semibold shrink-0 border",
                          showCorrect && "bg-emerald-500 text-white border-emerald-500",
                          showIncorrect && "bg-red-500 text-white border-red-500",
                          !showCorrect && !showIncorrect && "border-border"
                        )}
                      >
                        {showCorrect ? (
                          <motion.span variants={popIn} initial="hidden" animate="visible">
                            <CheckIcon className="size-4" />
                          </motion.span>
                        ) : showIncorrect ? (
                          <XIcon className="size-4" />
                        ) : (
                          String.fromCharCode(65 + optIdx)
                        )}
                      </span>
                      <span className="text-sm font-medium">{option}</span>
                    </div>
                  </button>
                </motion.div>
              );
            })}
          </div>

          {answered && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="glass-card rounded-xl p-4">
                <RichText text={current.explanation} className="text-sm [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleNext} className="gap-2">
                  {currentIdx < total - 1 ? "Next Question" : "See Results"}
                  <ArrowRightIcon className="size-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
