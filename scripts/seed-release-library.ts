import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  recordSeedGeneratedAt,
  seedReleaseLibrary,
  type ReleasePayload,
} from "../src/lib/seed-release-library";

const prisma = new PrismaClient();

async function main() {
  const source = path.join(process.cwd(), "data", "release-library", "session-content.json");
  const raw = await readFile(source, "utf-8");
  const payload = JSON.parse(raw) as ReleasePayload;

  const result = await seedReleaseLibrary(prisma, payload);
  await recordSeedGeneratedAt(prisma, result.generatedAt);

  console.log(
    `Seeded release library from snapshot (${result.generatedAt}). ` +
      `Removed stale: ${result.removed}, Created: ${result.created}, Updated: ${result.updated}, Total: ${result.total}`
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
