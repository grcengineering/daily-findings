import { PrismaClient } from "@prisma/client";

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function validateQuiz(topicId: string, quizRaw: string): string[] {
  const issues: string[] = [];
  const quiz = safeParse<{ questions?: unknown[] }>(quizRaw, {});
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

  questions.forEach((question, index) => {
    const q = question as Record<string, unknown>;
    if (q.format === "code_challenge") {
      const validation = (q.validation ?? {}) as Record<string, unknown>;
      const required = Array.isArray(validation.required_patterns)
        ? (validation.required_patterns as string[])
        : [];
      const forbidden = Array.isArray(validation.forbidden_patterns)
        ? (validation.forbidden_patterns as string[])
        : [];
      const solutionCode = String(q.solution_code ?? "");
      for (const pattern of required) {
        if (!solutionCode.includes(pattern)) {
          issues.push(`${topicId} q${index + 1}: required pattern missing in solution: ${pattern}`);
        }
      }
      for (const pattern of forbidden) {
        if (solutionCode.includes(pattern)) {
          issues.push(`${topicId} q${index + 1}: forbidden pattern found in solution: ${pattern}`);
        }
      }
      return;
    }

    const options = Array.isArray(q.options) ? q.options : [];
    const correctIndex = Number(q.correctIndex);
    if (options.length !== 4) {
      issues.push(`${topicId} q${index + 1}: expected 4 options, got ${options.length}`);
    }
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      issues.push(`${topicId} q${index + 1}: invalid correctIndex ${String(q.correctIndex)}`);
    }
  });

  return issues;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.sessionContent.findMany({
      select: { topicId: true, prerequisites: true, quizContent: true },
    });
    const ids = new Set(rows.map((r) => r.topicId));
    const issues: string[] = [];

    for (const row of rows) {
      const prereqs = safeParse<string[]>(row.prerequisites, []);
      for (const prereq of prereqs) {
        if (!ids.has(prereq)) {
          issues.push(`${row.topicId}: missing prerequisite reference ${prereq}`);
        }
      }
      issues.push(...validateQuiz(row.topicId, row.quizContent));
    }

    if (issues.length > 0) {
      console.error("Curriculum validation failed:");
      for (const issue of issues) {
        console.error(`- ${issue}`);
      }
      process.exit(1);
    }

    console.log(`Curriculum validation passed for ${rows.length} session rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Validation script failed:", error);
  process.exit(1);
});
