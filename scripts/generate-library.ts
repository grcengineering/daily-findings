import { config } from "dotenv";
config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";

const WORKER_ID = process.argv[2] ?? "solo";
const TOTAL_WORKERS = parseInt(process.argv[3] ?? "1", 10);
const WORKER_INDEX = parseInt(process.argv[4] ?? "0", 10);

let shutdownRequested = false;

process.on("SIGINT", () => {
  if (shutdownRequested) {
    console.log(`\n[Worker ${WORKER_ID}] Forced shutdown.`);
    process.exit(1);
  }
  shutdownRequested = true;
  console.log(`\n[Worker ${WORKER_ID}] Graceful shutdown requested. Finishing current topic...`);
});

interface TopicInfo {
  id: string;
  title: string;
  objectives: string[];
  keyTerms: string[];
  promptHints: string;
  domain: string;
  level: string;
}

interface TopicInput {
  title: string;
  objectives: string[];
  keyTerms: string[];
  promptHints: string;
  domain: string;
  level: string;
}

interface BatchResult {
  generated: number;
  skipped: number;
  failed: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenerateFn = (input: TopicInput, domain: string, level: string) => Promise<any>;

let getAllTopics: () => TopicInfo[];
let generateLesson: GenerateFn;
let generateScenario: GenerateFn;
let generateQuiz: GenerateFn;

async function loadModules() {
  const curriculum = await import("../src/lib/curriculum");
  const ai = await import("../src/lib/ai");
  getAllTopics = curriculum.getAllTopics;
  generateLesson = ai.generateLesson;
  generateScenario = ai.generateScenario;
  generateQuiz = ai.generateQuiz;
}

async function processTopic(
  prisma: PrismaClient,
  topic: TopicInfo,
  index: number,
  total: number,
): Promise<"generated" | "skipped" | "failed"> {
  const pad = String(total).length;
  const label = `[W${WORKER_ID} ${String(index + 1).padStart(pad, " ")}/${total}]`;

  const existing = await prisma.sessionContent.findUnique({
    where: { topicId: topic.id },
  });

  if (existing) {
    console.log(`${label} SKIP ${topic.title}`);
    return "skipped";
  }

  try {
    const input: TopicInput = {
      title: topic.title,
      objectives: topic.objectives,
      keyTerms: topic.keyTerms,
      promptHints: topic.promptHints,
      domain: topic.domain,
      level: topic.level,
    };

    const [lesson, scenario, quiz] = await Promise.all([
      generateLesson(input, topic.domain, topic.level),
      generateScenario(input, topic.domain, topic.level),
      generateQuiz(input, topic.domain, topic.level),
    ]);

    const scores = [
      lesson.confidenceScore,
      scenario.confidenceScore,
      quiz.confidenceScore,
    ].filter((s): s is number => typeof s === "number");

    const aggregateConfidence = scores.length > 0 ? Math.min(...scores) : null;

    try {
      await prisma.sessionContent.create({
        data: {
          topicId: topic.id,
          domain: topic.domain,
          topic: topic.title,
          level: topic.level,
          lessonContent: JSON.stringify(lesson),
          scenarioContent: JSON.stringify(scenario),
          quizContent: JSON.stringify(quiz),
          confidenceScore: aggregateConfidence,
        },
      });
    } catch (dbErr: unknown) {
      const prismaError = dbErr as { code?: string };
      if (prismaError.code === "P2002") {
        console.log(`${label} SKIP ${topic.title} (completed by another worker)`);
        return "skipped";
      }
      throw dbErr;
    }

    const lPct = lesson.confidenceScore ?? "n/a";
    const sPct = scenario.confidenceScore ?? "n/a";
    const qPct = quiz.confidenceScore ?? "n/a";

    console.log(
      `${label} OK   ${topic.title} (${topic.domain} / ${topic.level}) lesson:${lPct}% scenario:${sPct}% quiz:${qPct}%`,
    );
    return "generated";
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`${label} FAIL ${topic.title} -- Error: ${message}`);
    return "failed";
  }
}

async function main() {
  await loadModules();

  const prisma = new PrismaClient();

  try {
    const allTopics: TopicInfo[] = getAllTopics();

    const topics = allTopics.filter((_, i) => i % TOTAL_WORKERS === WORKER_INDEX);

    console.log(`[Worker ${WORKER_ID}] Assigned ${topics.length} of ${allTopics.length} topics (worker ${WORKER_INDEX + 1}/${TOTAL_WORKERS})\n`);

    const result: BatchResult = { generated: 0, skipped: 0, failed: 0 };

    for (let i = 0; i < topics.length; i++) {
      if (shutdownRequested) {
        console.log(`\n[Worker ${WORKER_ID}] Shutdown: stopping.`);
        break;
      }

      const outcome = await processTopic(prisma, topics[i], i, topics.length);
      result[outcome]++;
    }

    console.log(`\n[Worker ${WORKER_ID}] --- Summary ---`);
    console.log(`Generated: ${result.generated}`);
    console.log(`Skipped:   ${result.skipped}`);
    console.log(`Failed:    ${result.failed}`);
    console.log(
      `Total:     ${result.generated + result.skipped + result.failed}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(`[Worker ${WORKER_ID}] Fatal error:`, err);
  process.exit(1);
});
