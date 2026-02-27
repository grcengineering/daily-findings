import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const TOPIC_ID = process.argv[2];
const SECTION = process.argv[3] as "lesson" | "scenario" | "quiz";

if (!TOPIC_ID || !SECTION) {
  console.error("Usage: npx tsx scripts/fix-sections.ts <topicId> <lesson|scenario|quiz>");
  process.exit(1);
}

interface TopicInput {
  title: string;
  objectives: string[];
  keyTerms: string[];
  promptHints: string;
  domain: string;
  level: string;
}

async function main() {
  const curriculum = await import("../src/lib/curriculum");
  const ai = await import("../src/lib/ai");

  const topic = curriculum.getTopicById(TOPIC_ID);
  if (!topic) {
    console.error(`Topic ${TOPIC_ID} not found in curriculum`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const existing = await prisma.sessionContent.findUnique({
      where: { topicId: TOPIC_ID },
    });

    if (!existing) {
      console.error(`No session content found for ${TOPIC_ID}`);
      process.exit(1);
    }

    const input: TopicInput = {
      title: topic.title,
      objectives: topic.objectives,
      keyTerms: topic.keyTerms,
      promptHints: topic.promptHints,
      domain: topic.domain,
      level: topic.level,
    };

    console.log(`Fixing ${SECTION} for: ${topic.title} (${topic.domain} / ${topic.level})`);

    let newContent: object;

    if (SECTION === "lesson") {
      newContent = await ai.generateLesson(input, topic.domain, topic.level);
    } else if (SECTION === "scenario") {
      newContent = await ai.generateScenario(input, topic.domain, topic.level);
    } else {
      newContent = await ai.generateQuiz(input, topic.domain, topic.level);
    }

    console.log(`Generated new ${SECTION} content`);

    const contentField = SECTION === "lesson" ? "lessonContent"
      : SECTION === "scenario" ? "scenarioContent"
      : "quizContent";

    await prisma.sessionContent.update({
      where: { topicId: TOPIC_ID },
      data: {
        [contentField]: JSON.stringify(newContent),
      },
    });

    console.log(`Updated ${SECTION} for ${topic.title}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
