import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

type ReleaseRow = {
  topicId: string;
  domain: string;
  topic: string;
  level: string;
  moduleType: string;
  competencyIds: string;
  prerequisites: string;
  lessonContent: string;
  scenarioContent: string;
  quizContent: string;
  capstoneContent: string | null;
};

type ReleasePayload = {
  generatedAt: string;
  totalModules: number;
  rows: ReleaseRow[];
};

async function main() {
  const source = path.join(process.cwd(), "data", "release-library", "session-content.json");
  const raw = await readFile(source, "utf-8");
  const payload = JSON.parse(raw) as ReleasePayload;

  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("Release library payload contains no rows.");
  }

  const topicIds = new Set(payload.rows.map((row) => row.topicId));
  const staleRows = await prisma.sessionContent.findMany({ select: { topicId: true } });
  const staleTopicIds = staleRows.map((row) => row.topicId).filter((topicId) => !topicIds.has(topicId));

  if (staleTopicIds.length > 0) {
    await prisma.sessionCompletion.deleteMany({ where: { topicId: { in: staleTopicIds } } });
    await prisma.topicProgress.deleteMany({ where: { topicId: { in: staleTopicIds } } });
    await prisma.sessionContent.deleteMany({ where: { topicId: { in: staleTopicIds } } });
  }

  let created = 0;
  let updated = 0;
  for (const row of payload.rows) {
    const existing = await prisma.sessionContent.findUnique({ where: { topicId: row.topicId } });
    if (existing) {
      await prisma.sessionContent.update({
        where: { topicId: row.topicId },
        data: row,
      });
      updated++;
    } else {
      await prisma.sessionContent.create({ data: row });
      created++;
    }
  }

  console.log(
    `Seeded release library from snapshot (${payload.generatedAt}). ` +
      `Removed stale: ${staleTopicIds.length}, Created: ${created}, Updated: ${updated}, Total: ${payload.rows.length}`
  );
}

main()
  .catch((error) => {
    console.error("Failed to seed release library:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
