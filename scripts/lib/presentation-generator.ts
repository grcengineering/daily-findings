import type { CapstoneContent, CodeChallengeItem } from "./schema-generator";

export function preserveCodeBlocks(text: string): string {
  return text.replace(/\r\n/g, "\n");
}

export function formatCodeChallenge(item: CodeChallengeItem): CodeChallengeItem {
  return {
    ...item,
    starter_code: preserveCodeBlocks(item.starter_code),
    solution_code: preserveCodeBlocks(item.solution_code),
    explanation: item.explanation.trim(),
  };
}

export function formatCapstoneContent(content: CapstoneContent): CapstoneContent {
  return {
    deliverable_prompt: content.deliverable_prompt.trim(),
    deliverable_format: content.deliverable_format.trim(),
    synthesis_questions: content.synthesis_questions.map((q) => ({
      question: q.question.trim(),
      guidance: q.guidance.trim(),
    })),
    scenario_decisions: content.scenario_decisions.map((d) => ({
      situation: d.situation.trim(),
      options: d.options.map((opt) => opt.trim()),
      best_option: d.best_option.trim(),
      rationale: d.rationale.trim(),
    })),
    rubric: content.rubric.map((r) => ({
      criterion: r.criterion.trim(),
      excellent: r.excellent.trim(),
      acceptable: r.acceptable.trim(),
      needs_work: r.needs_work.trim(),
    })),
  };
}
