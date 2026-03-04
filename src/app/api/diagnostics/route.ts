import { NextResponse } from "next/server";
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL ?? "(not set)";
  const filePath = dbUrl.replace(/^file:/, "");
  const cwd = process.cwd();
  const nodeVersion = process.version;
  const platform = `${process.platform}/${process.arch}`;

  const dbExists = existsSync(filePath);
  const dbSize = dbExists ? statSync(filePath).size : null;

  const prismaEnginePath = path.join(
    cwd,
    "node_modules",
    ".prisma",
    "client",
    `libquery_engine-darwin-arm64.dylib.node`
  );
  const engineExists = existsSync(prismaEnginePath);

  let prismaStatus = "unknown";
  let prismaError: string | null = null;
  let recordCount: number | null = null;

  try {
    const { PrismaClient } = await import("@prisma/client");
    const testClient = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });
    recordCount = await testClient.sessionContent.count();
    await testClient.$disconnect();
    prismaStatus = "connected";
  } catch (e: unknown) {
    prismaStatus = "error";
    prismaError = e instanceof Error ? e.message : String(e);
  }

  let sidecarLog: string | null = null;
  let nextStderrLog: string | null = null;
  try {
    const appDataPaths = [
      path.join(
        process.env.HOME ?? "",
        "Library",
        "Application Support",
        "com.dailyfindings.desktop"
      ),
    ];
    for (const dir of appDataPaths) {
      const logPath = path.join(dir, "sidecar.log");
      if (existsSync(logPath)) {
        sidecarLog = readFileSync(logPath, "utf-8").slice(-4000);
      }
      const stderrPath = path.join(dir, "next-stderr.log");
      if (existsSync(stderrPath)) {
        nextStderrLog = readFileSync(stderrPath, "utf-8").slice(-4000);
      }
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json({
    databaseUrl: dbUrl,
    dbFilePath: filePath,
    dbExists,
    dbSizeBytes: dbSize,
    cwd,
    nodeVersion,
    platform,
    prismaEngineExists: engineExists,
    prismaStatus,
    prismaError,
    sessionContentCount: recordCount,
    sidecarLog,
    nextStderrLog,
  });
}
