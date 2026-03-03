import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
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

async function main() {
  const rows = await prisma.sessionContent.findMany({
    orderBy: { topicId: "asc" },
    select: {
      topicId: true,
      domain: true,
      topic: true,
      level: true,
      moduleType: true,
      competencyIds: true,
      prerequisites: true,
      lessonContent: true,
      scenarioContent: true,
      quizContent: true,
      capstoneContent: true,
    },
  });

  if (rows.length === 0) {
    throw new Error("No SessionContent rows found to export.");
  }

  const releaseRows: ReleaseRow[] = rows.map((row) => ({
    topicId: row.topicId,
    domain: row.domain,
    topic: row.topic,
    level: row.level,
    moduleType: row.moduleType,
    competencyIds: row.competencyIds,
    prerequisites: row.prerequisites,
    lessonContent: row.lessonContent,
    scenarioContent: row.scenarioContent,
    quizContent: row.quizContent,
    capstoneContent: row.capstoneContent,
  }));

  const outDir = path.join(process.cwd(), "data", "release-library");
  const outFile = path.join(outDir, "session-content.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    outFile,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalModules: releaseRows.length,
        rows: releaseRows,
      },
      null,
      2
    )}\n`,
    "utf-8"
  );

  console.log(`Exported ${releaseRows.length} rows to ${outFile}`);
}

main()
  .catch((error) => {
    console.error("Failed to export release library:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
