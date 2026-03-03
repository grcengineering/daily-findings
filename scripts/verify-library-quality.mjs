#!/usr/bin/env node
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import path from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

const dbUrl = process.env.DATABASE_URL ?? "";
if (dbUrl.startsWith("file:./")) {
  const resolved = path.resolve(process.cwd(), dbUrl.slice("file:".length));
  process.env.DATABASE_URL = `file:${resolved}`;
}

const prisma = new PrismaClient();

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function textLength(lesson) {
  if (!lesson || typeof lesson !== "object") return 0;
  const intro = typeof lesson.introduction === "string" ? lesson.introduction.length : 0;
  const sections = Array.isArray(lesson.sections)
    ? lesson.sections.reduce((sum, section) => {
        const heading = typeof section?.heading === "string" ? section.heading.length : 0;
        const content = typeof section?.content === "string" ? section.content.length : 0;
        return sum + heading + content;
      }, 0)
    : 0;
  const takeaways = Array.isArray(lesson.keyTakeaways)
    ? lesson.keyTakeaways.reduce((sum, item) => sum + (typeof item === "string" ? item.length : 0), 0)
    : 0;
  return intro + sections + takeaways;
}

function hasCitations(content) {
  return !!(content && Array.isArray(content.citations) && content.citations.length > 0);
}

async function main() {
  const rows = await prisma.sessionContent.findMany({
    select: {
      topicId: true,
      lessonContent: true,
      scenarioContent: true,
      quizContent: true,
    },
  });

  if (rows.length === 0) {
    throw new Error("No SessionContent rows found. Library is empty.");
  }

  let lessonCharsTotal = 0;
  let lessonsWithCitations = 0;
  let scenariosWithCitations = 0;
  let quizzesWithCitations = 0;
  let allAQuizCount = 0;
  let seededIntroMatches = 0;

  const seededIntroFragment =
    "introduces the operational context, control intent, and common implementation pitfalls.";

  for (const row of rows) {
    const lesson = safeParse(row.lessonContent, {});
    const scenario = safeParse(row.scenarioContent, {});
    const quiz = safeParse(row.quizContent, { questions: [] });
    const questions = Array.isArray(quiz.questions) ? quiz.questions : [];

    const lessonChars = textLength(lesson);
    lessonCharsTotal += lessonChars;

    if (hasCitations(lesson)) lessonsWithCitations++;
    if (hasCitations(scenario)) scenariosWithCitations++;
    if (hasCitations(quiz)) quizzesWithCitations++;

    const mcQuestions = questions.filter((q) => (q?.format ?? "multiple_choice") === "multiple_choice");
    if (
      mcQuestions.length >= 4 &&
      mcQuestions.every((q) => typeof q.correctIndex === "number" && q.correctIndex === 0)
    ) {
      allAQuizCount++;
    }

    const intro = typeof lesson.introduction === "string" ? lesson.introduction : "";
    if (intro.includes(seededIntroFragment)) {
      seededIntroMatches++;
    }
  }

  const total = rows.length;
  const avgLessonChars = lessonCharsTotal / total;
  const lessonCitationRate = lessonsWithCitations / total;
  const scenarioCitationRate = scenariosWithCitations / total;
  const quizCitationRate = quizzesWithCitations / total;
  const allAQuizRate = allAQuizCount / total;
  const seededIntroRate = seededIntroMatches / total;

  const metrics = {
    totalModules: total,
    avgLessonChars: Math.round(avgLessonChars),
    lessonCitationRate: Number((lessonCitationRate * 100).toFixed(1)),
    scenarioCitationRate: Number((scenarioCitationRate * 100).toFixed(1)),
    quizCitationRate: Number((quizCitationRate * 100).toFixed(1)),
    allAQuizRate: Number((allAQuizRate * 100).toFixed(1)),
    seededIntroRate: Number((seededIntroRate * 100).toFixed(1)),
  };

  console.log("Library quality metrics:", JSON.stringify(metrics, null, 2));

  const failures = [];
  if (avgLessonChars < 1400) {
    failures.push(`Average lesson length too low (${Math.round(avgLessonChars)} chars < 1400).`);
  }
  if (lessonCitationRate < 0.5) {
    failures.push(`Lesson citation coverage too low (${(lessonCitationRate * 100).toFixed(1)}% < 50%).`);
  }
  if (scenarioCitationRate < 0.5) {
    failures.push(`Scenario citation coverage too low (${(scenarioCitationRate * 100).toFixed(1)}% < 50%).`);
  }
  if (allAQuizRate > 0.25) {
    failures.push(`Too many all-A quizzes (${(allAQuizRate * 100).toFixed(1)}% > 25%).`);
  }
  if (seededIntroRate > 0.2) {
    failures.push(
      `Seed-template intro detected too often (${(seededIntroRate * 100).toFixed(1)}% > 20%).`
    );
  }

  if (failures.length > 0) {
    throw new Error(`Library quality checks failed:\n- ${failures.join("\n- ")}`);
  }

  console.log("Library quality checks passed.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
