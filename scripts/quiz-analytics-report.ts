import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.questionAnalytics.findMany({
      orderBy: [{ attemptCount: "desc" }, { topicId: "asc" }],
    });
    const lowDiscrimination = rows.filter(
      (row) => row.discrimination != null && row.discrimination < 0.2
    );
    const extremeDifficulty = rows.filter(
      (row) => row.correctRate != null && (row.correctRate < 0.3 || row.correctRate > 0.9)
    );
    const highRetry = rows.filter((row) => row.retryCount >= 3);

    console.log(`Question analytics rows: ${rows.length}`);
    console.log(`Low discrimination: ${lowDiscrimination.length}`);
    console.log(`Extreme difficulty: ${extremeDifficulty.length}`);
    console.log(`High retry questions: ${highRetry.length}`);

    for (const row of [...lowDiscrimination.slice(0, 5), ...extremeDifficulty.slice(0, 5)]) {
      console.log(
        `${row.topicId}::${row.questionId} attempts=${row.attemptCount} correctRate=${row.correctRate ?? "n/a"} discrimination=${row.discrimination ?? "n/a"} retries=${row.retryCount}`
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
