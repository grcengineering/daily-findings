export interface QuizValidationIssue {
  code: string;
  message: string;
}

function uniqueStrings(values: string[]): boolean {
  return new Set(values.map((v) => v.trim().toLowerCase())).size === values.length;
}

export function validateQuizDeterministic(
  topicId: string,
  quizRaw: string
): QuizValidationIssue[] {
  const issues: QuizValidationIssue[] = [];
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(quizRaw);
  } catch {
    return [
      {
        code: "QUIZ_INVALID_JSON",
        message: `${topicId}: quiz JSON failed to parse`,
      },
    ];
  }

  const quiz = parsed as { questions?: unknown[] };
  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const seenQuestionIds = new Set<string>();
  const seenQuestionTexts = new Set<string>();

  questions.forEach((question, index) => {
    const q = question as Record<string, unknown>;
    const qid = String(q.id ?? `q${index + 1}`);
    if (seenQuestionIds.has(qid)) {
      issues.push({
        code: "QUIZ_DUPLICATE_ID",
        message: `${topicId} q${index + 1}: duplicate id "${qid}"`,
      });
    }
    seenQuestionIds.add(qid);

    if (q.format === "code_challenge") {
      const explanation = String(q.explanation ?? "").trim();
      if (explanation.length < 20) {
        issues.push({
          code: "CODE_EXPLANATION_TOO_SHORT",
          message: `${topicId} q${index + 1}: code challenge explanation too short`,
        });
      }
      return;
    }

    const questionText = String(q.question ?? "").trim();
    if (questionText.length < 12) {
      issues.push({
        code: "QUESTION_TOO_SHORT",
        message: `${topicId} q${index + 1}: question text too short`,
      });
    }
    const normalized = questionText.toLowerCase();
    if (seenQuestionTexts.has(normalized)) {
      issues.push({
        code: "QUESTION_DUPLICATE_TEXT",
        message: `${topicId} q${index + 1}: duplicate question text`,
      });
    }
    seenQuestionTexts.add(normalized);

    const options = Array.isArray(q.options)
      ? q.options.map((opt) => String(opt))
      : [];
    if (options.length !== 4) {
      issues.push({
        code: "QUESTION_OPTION_COUNT",
        message: `${topicId} q${index + 1}: expected 4 options, got ${options.length}`,
      });
    }
    if (!uniqueStrings(options)) {
      issues.push({
        code: "QUESTION_DUPLICATE_OPTIONS",
        message: `${topicId} q${index + 1}: duplicate answer options found`,
      });
    }
    const correctIndex = Number(q.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) {
      issues.push({
        code: "QUESTION_INVALID_CORRECT_INDEX",
        message: `${topicId} q${index + 1}: invalid correctIndex ${String(q.correctIndex)}`,
      });
    }

    const explanation = String(q.explanation ?? "").trim();
    if (explanation.length < 20) {
      issues.push({
        code: "QUESTION_EXPLANATION_TOO_SHORT",
        message: `${topicId} q${index + 1}: explanation too short`,
      });
    }
  });

  return issues;
}
