import { PrismaClient } from "@prisma/client";

type ParsedQuestion = {
  id?: string;
  format?: string;
  options?: string[];
};

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const contents = await prisma.sessionContent.findMany({
      select: { topicId: true, quizContent: true },
    });
    const completions = await prisma.sessionCompletion.findMany({
      select: { topicId: true, quizScore: true, quizTotal: true, date: true },
    });

    for (const content of contents) {
      const quiz = safeParse<{ questions?: ParsedQuestion[] }>(content.quizContent, {});
      const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
      const topicCompletions = completions.filter((row) => row.topicId === content.topicId);
      const correctRate =
        topicCompletions.length > 0
          ? topicCompletions.reduce((sum, row) => {
              const score = row.quizScore ?? 0;
              const total = Math.max(row.quizTotal ?? 0, 1);
              return sum + score / total;
            }, 0) / topicCompletions.length
          : 0;

      for (let index = 0; index < questions.length; index++) {
        const question = questions[index];
        const questionId = question.id ?? `q${index + 1}`;
        await prisma.questionAnalytics.upsert({
          where: { topicId_questionId: { topicId: content.topicId, questionId } },
          create: {
            topicId: content.topicId,
            questionId,
            questionIndex: index,
            format: question.format ?? "multiple_choice",
            attemptCount: topicCompletions.length,
            correctRate,
            discrimination: null,
            firstTryCorrect: Math.round(correctRate * topicCompletions.length),
            retryCount: Math.max(0, topicCompletions.length - Math.round(correctRate * topicCompletions.length)),
            optionStats: "{}",
          },
          update: {
            questionIndex: index,
            format: question.format ?? "multiple_choice",
            attemptCount: topicCompletions.length,
            correctRate,
          },
        });
      }
    }
    console.log("Quiz analytics computation complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
