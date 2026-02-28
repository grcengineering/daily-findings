import { PrismaClient } from "@prisma/client";
import { existsSync } from "node:fs";
import path from "node:path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function normalizeDatabaseUrlForRootRuntime() {
  const rawUrl = process.env.DATABASE_URL ?? "";
  if (!rawUrl.startsWith("file:")) return;
  const filePath = rawUrl.replace(/^file:/, "");
  if (!filePath.startsWith("./")) return;

  const cwdCandidate = path.resolve(process.cwd(), filePath);
  const prismaCandidate = path.resolve(process.cwd(), "prisma", "dev.db");

  // If the configured relative DB does not exist but prisma/dev.db does, auto-heal.
  if (!existsSync(cwdCandidate) && existsSync(prismaCandidate)) {
    process.env.DATABASE_URL = `file:${prismaCandidate}`;
  }
}

normalizeDatabaseUrlForRootRuntime();

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
