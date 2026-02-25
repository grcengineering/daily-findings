import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const TOPIC_ID = process.argv[2];
const SECTION = process.argv[3] as "lesson" | "scenario" | "quiz";
const EXTRA_INSTRUCTIONS = process.argv[4] || "";

if (!TOPIC_ID || !SECTION) {
  console.error("Usage: npx tsx scripts/fix-targeted.ts <topicId> <section> [extra-instructions]");
  process.exit(1);
}

async function main() {
  const curriculum = await import("../src/lib/curriculum");
  const ai = await import("../src/lib/ai");

  const topic = curriculum.getTopicById(TOPIC_ID);
  if (!topic) {
    console.error(`Topic ${TOPIC_ID} not found`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.sessionContent.findUnique({
      where: { topicId: TOPIC_ID },
    });
    if (!existing) {
      console.error(`No session for ${TOPIC_ID}`);
      process.exit(1);
    }

    const input = {
      title: topic.title,
      objectives: topic.objectives,
      keyTerms: topic.keyTerms,
      promptHints: topic.promptHints + "\n\nADDITIONAL INSTRUCTIONS: " + EXTRA_INSTRUCTIONS,
      domain: topic.domain,
      level: topic.level,
    };

    console.log(`Fixing ${SECTION} for: ${topic.title}`);
    console.log(`Extra instructions: ${EXTRA_INSTRUCTIONS}`);

    let newContent: { confidenceScore?: number };
    if (SECTION === "lesson") {
      newContent = await ai.generateLesson(input, topic.domain, topic.level);
    } else if (SECTION === "scenario") {
      newContent = await ai.generateScenario(input, topic.domain, topic.level);
    } else {
      newContent = await ai.generateQuiz(input, topic.domain, topic.level);
    }

    const newScore = newContent.confidenceScore ?? 0;
    console.log(`New ${SECTION} score: ${newScore}%`);

    const contentField = SECTION === "lesson" ? "lessonContent"
      : SECTION === "scenario" ? "scenarioContent" : "quizContent";

    const otherSections = {
      lesson: JSON.parse(existing.lessonContent),
      scenario: JSON.parse(existing.scenarioContent),
      quiz: JSON.parse(existing.quizContent),
    };
    otherSections[SECTION] = newContent;

    const scores = [
      otherSections.lesson.confidenceScore,
      otherSections.scenario.confidenceScore,
      otherSections.quiz.confidenceScore,
    ].filter((s): s is number => typeof s === "number");

    const newAggregate = scores.length > 0 ? Math.min(...scores) : null;

    await prisma.sessionContent.update({
      where: { topicId: TOPIC_ID },
      data: {
        [contentField]: JSON.stringify(newContent),
        confidenceScore: newAggregate,
      },
    });

    console.log(`Updated. New aggregate: ${newAggregate}%`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
