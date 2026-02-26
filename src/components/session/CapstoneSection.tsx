"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RichText } from "./RichText";

interface CapstoneDecision {
  situation: string;
  options: string[];
  best_option: string;
  rationale: string;
}

interface CapstoneRubricItem {
  criterion: string;
  excellent: string;
  acceptable: string;
  needs_work: string;
}

export interface CapstoneContent {
  deliverable_prompt: string;
  deliverable_format: string;
  synthesis_questions: Array<{ question: string; guidance: string }>;
  scenario_decisions: CapstoneDecision[];
  rubric: CapstoneRubricItem[];
}

interface CapstoneSectionProps {
  capstone: CapstoneContent;
  onComplete: () => void;
}

export function CapstoneSection({ capstone, onComplete }: CapstoneSectionProps) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  return (
    <div className="max-w-[820px] mx-auto py-8 px-4 space-y-6">
      <div className="glass-card rounded-xl p-6 space-y-3">
        <Badge variant="secondary">Capstone Deliverable</Badge>
        <RichText text={capstone.deliverable_prompt} className="font-semibold" />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Format:</span> {capstone.deliverable_format}
        </p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-3">
        <h3 className="font-semibold">Synthesis Questions</h3>
        {capstone.synthesis_questions.map((item, idx) => (
          <div key={idx} className="rounded-lg border border-border p-4">
            <RichText text={item.question} className="font-medium [&_p]:font-medium" />
            <RichText text={item.guidance} className="text-sm text-muted-foreground mt-1" />
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-6 space-y-3">
        <h3 className="font-semibold">Scenario Decisions</h3>
        {capstone.scenario_decisions.map((decision, idx) => (
          <div key={idx} className="rounded-lg border border-border p-4 space-y-2">
            <RichText text={decision.situation} className="font-medium [&_p]:font-medium" />
            <ul className="text-sm text-muted-foreground space-y-1">
              {decision.options.map((opt, j) => (
                <li key={j}>- {opt}</li>
              ))}
            </ul>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRevealed((prev) => ({ ...prev, [idx]: !prev[idx] }))}
            >
              {revealed[idx] ? "Hide rationale" : "Reveal best option"}
            </Button>
            {revealed[idx] && (
              <div className="text-sm">
                <span className="font-semibold">Best option:</span> {decision.best_option}.{" "}
                <span className="text-muted-foreground">{decision.rationale}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="glass-card rounded-xl p-6 space-y-3">
        <h3 className="font-semibold">Rubric Self-Assessment</h3>
        {capstone.rubric.map((row, idx) => (
          <div key={idx} className="rounded-lg border border-border p-4">
            <RichText text={row.criterion} className="font-medium [&_p]:font-medium" />
            <RichText text={`Excellent: ${row.excellent}`} className="text-sm mt-2 [&_p]:text-sm" />
            <RichText text={`Acceptable: ${row.acceptable}`} className="text-sm [&_p]:text-sm" />
            <RichText text={`Needs work: ${row.needs_work}`} className="text-sm [&_p]:text-sm" />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="lg" onClick={onComplete}>
          Complete Capstone
        </Button>
      </div>
    </div>
  );
}
