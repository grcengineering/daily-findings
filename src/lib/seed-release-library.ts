import type { PrismaClient } from "@prisma/client";

export type ReleaseRow = {
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

export type ReleasePayload = {
  generatedAt: string;
  totalModules: number;
  rows: ReleaseRow[];
};

export interface SeedResult {
  removed: number;
  created: number;
  updated: number;
  total: number;
  generatedAt: string;
}

/**
 * Idempotent reseed of `SessionContent` rows from a release snapshot.
 *
 * Preserves user progress: only `SessionCompletion` and `TopicProgress`
 * rows whose `topicId` is NO LONGER present in the new release are
 * deleted. Existing rows for still-present topics keep their XP, streaks,
 * scores, capstone state, analytics, etc. untouched.
 */
export async function seedReleaseLibrary(
  prisma: PrismaClient,
  payload: ReleasePayload
): Promise<SeedResult> {
  if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
    throw new Error("Release library payload contains no rows.");
  }

  const topicIds = new Set(payload.rows.map((row) => row.topicId));
  const staleRows = await prisma.sessionContent.findMany({
    select: { topicId: true },
  });
  const staleTopicIds = staleRows
    .map((row) => row.topicId)
    .filter((topicId) => !topicIds.has(topicId));

  if (staleTopicIds.length > 0) {
    await prisma.sessionCompletion.deleteMany({
      where: { topicId: { in: staleTopicIds } },
    });
    await prisma.topicProgress.deleteMany({
      where: { topicId: { in: staleTopicIds } },
    });
    await prisma.sessionContent.deleteMany({
      where: { topicId: { in: staleTopicIds } },
    });
  }

  let created = 0;
  let updated = 0;
  for (const row of payload.rows) {
    const existing = await prisma.sessionContent.findUnique({
      where: { topicId: row.topicId },
    });
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

  return {
    removed: staleTopicIds.length,
    created,
    updated,
    total: payload.rows.length,
    generatedAt: payload.generatedAt,
  };
}

/**
 * Returns true when the supplied snapshot has not yet been applied to the
 * caller-supplied DB. Used by the runtime instrumentation hook to skip
 * the reseed cost on warm boots.
 */
export async function snapshotIsNewer(
  prisma: PrismaClient,
  payload: ReleasePayload
): Promise<boolean> {
  const stats = await prisma.userStats.findUnique({ where: { id: "user" } });
  if (!stats) return true;
  return stats.seedGeneratedAt !== payload.generatedAt;
}

/**
 * Persist the snapshot's `generatedAt` so subsequent boots can skip
 * reseeding. Creates the singleton `UserStats` row if missing.
 */
export async function recordSeedGeneratedAt(
  prisma: PrismaClient,
  generatedAt: string
): Promise<void> {
  await prisma.userStats.upsert({
    where: { id: "user" },
    update: { seedGeneratedAt: generatedAt },
    create: { id: "user", seedGeneratedAt: generatedAt },
  });
}
