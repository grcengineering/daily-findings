"use client";

import { useEffect, useMemo, useState } from "react";
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
  topicId: string;
  capstone: CapstoneContent;
  onComplete: (rubricScores: Record<number, "excellent" | "acceptable" | "needs_work">) => void;
}

type RubricScore = "excellent" | "acceptable" | "needs_work";

function toMarkdown(
  capstone: CapstoneContent,
  rubricScores: Record<number, RubricScore>
) {
  const lines: string[] = [];
  lines.push(`# Capstone Export`);
  lines.push("");
  lines.push(`## Deliverable Prompt`);
  lines.push(capstone.deliverable_prompt);
  lines.push("");
  lines.push(`**Format:** ${capstone.deliverable_format}`);
  lines.push("");
  lines.push(`## Synthesis Questions`);
  capstone.synthesis_questions.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.question}`);
    lines.push(`   - Guidance: ${item.guidance}`);
  });
  lines.push("");
  lines.push(`## Scenario Decisions`);
  capstone.scenario_decisions.forEach((decision, idx) => {
    lines.push(`${idx + 1}. ${decision.situation}`);
    decision.options.forEach((option) => lines.push(`   - ${option}`));
    lines.push(`   - Best option: ${decision.best_option}`);
    lines.push(`   - Rationale: ${decision.rationale}`);
  });
  lines.push("");
  lines.push(`## Rubric Self-Assessment`);
  capstone.rubric.forEach((row, idx) => {
    lines.push(`- ${row.criterion}`);
    lines.push(`  - Excellent: ${row.excellent}`);
    lines.push(`  - Acceptable: ${row.acceptable}`);
    lines.push(`  - Needs work: ${row.needs_work}`);
    lines.push(`  - Selected: ${rubricScores[idx] ?? "not selected"}`);
  });
  lines.push("");
  return lines.join("\n");
}

export function CapstoneSection({ topicId, capstone, onComplete }: CapstoneSectionProps) {
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  const [rubricScores, setRubricScores] = useState<Record<number, RubricScore>>({});
  const rubricComplete = useMemo(
    () => capstone.rubric.length > 0 && capstone.rubric.every((_, idx) => rubricScores[idx]),
    [capstone.rubric, rubricScores]
  );

  useEffect(() => {
    let cancelled = false;
    async function loadRubric() {
      const response = await fetch(
        `/api/session/capstone-rubric?topicId=${encodeURIComponent(topicId)}`
      );
      if (!response.ok || cancelled) return;
      const payload = await response.json();
      if (!cancelled && payload?.rubricScores && typeof payload.rubricScores === "object") {
        setRubricScores(payload.rubricScores as Record<number, RubricScore>);
      }
    }
    void loadRubric();
    return () => {
      cancelled = true;
    };
  }, [topicId]);

  async function persistScores(nextScores: Record<number, RubricScore>) {
    await fetch("/api/session/capstone-rubric", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topicId, rubricScores: nextScores }),
    });
  }

  function exportMarkdown() {
    const content = toMarkdown(capstone, rubricScores);
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topicId.toLowerCase()}-capstone.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
            <div className="mt-3 flex gap-2 flex-wrap">
              {(["excellent", "acceptable", "needs_work"] as RubricScore[]).map((scoreOption) => (
                <Button
                  key={scoreOption}
                  size="sm"
                  variant={rubricScores[idx] === scoreOption ? "default" : "outline"}
                  onClick={() => {
                    const next = { ...rubricScores, [idx]: scoreOption };
                    setRubricScores(next);
                    void persistScores(next);
                  }}
                >
                  {scoreOption.replace("_", " ")}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="lg" variant="outline" onClick={exportMarkdown}>
          Export Markdown
        </Button>
        <Button size="lg" disabled={!rubricComplete} onClick={() => onComplete(rubricScores)}>
          Complete Capstone
        </Button>
      </div>
    </div>
  );
}
