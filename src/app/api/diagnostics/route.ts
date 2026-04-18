import { NextResponse } from "next/server";
import { existsSync, statSync, readFileSync } from "node:fs";
import path from "node:path";

const APP_IDENTIFIER = "com.dailyfindings.desktop";

function prismaEngineFilename(): string {
  if (process.platform === "win32") return "query_engine-windows.dll.node";
  if (process.platform === "darwin") {
    const arch = process.arch === "arm64" ? "arm64" : "x64";
    return `libquery_engine-darwin-${arch}.dylib.node`;
  }
  // linux fallback (used by CI)
  return `libquery_engine-debian-openssl-3.0.x.so.node`;
}

function appDataCandidates(): string[] {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
  if (process.platform === "darwin") {
    return [path.join(home, "Library", "Application Support", APP_IDENTIFIER)];
  }
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(home, "AppData", "Roaming");
    return [path.join(appData, APP_IDENTIFIER)];
  }
  return [
    path.join(home, ".local", "share", APP_IDENTIFIER),
    path.join(home, ".config", APP_IDENTIFIER),
  ];
}

function readTail(filePath: string, bytes: number): string | null {
  try {
    if (!existsSync(filePath)) return null;
    return readFileSync(filePath, "utf-8").slice(-bytes);
  } catch {
    return null;
  }
}

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
    prismaEngineFilename()
  );
  const engineExists = existsSync(prismaEnginePath);

  let prismaStatus = "unknown";
  let prismaError: string | null = null;
  let recordCount: number | null = null;
  let seedGeneratedAt: string | null = null;

  try {
    const { PrismaClient } = await import("@prisma/client");
    const testClient = new PrismaClient({
      datasources: { db: { url: dbUrl } },
    });
    recordCount = await testClient.sessionContent.count();
    const stats = await testClient.userStats.findUnique({ where: { id: "user" } });
    seedGeneratedAt = stats?.seedGeneratedAt ?? null;
    await testClient.$disconnect();
    prismaStatus = "connected";
  } catch (e: unknown) {
    prismaStatus = "error";
    prismaError = e instanceof Error ? e.message : String(e);
  }

  let sidecarLog: string | null = null;
  let nextStderrLog: string | null = null;
  let nextStdoutLog: string | null = null;
  let resolvedAppDataDir: string | null = null;
  for (const dir of appDataCandidates()) {
    const sidecar = readTail(path.join(dir, "sidecar.log"), 4000);
    const stderr = readTail(path.join(dir, "next-stderr.log"), 4000);
    const stdout = readTail(path.join(dir, "next-stdout.log"), 4000);
    if (sidecar || stderr || stdout) {
      resolvedAppDataDir = dir;
      sidecarLog = sidecar;
      nextStderrLog = stderr;
      nextStdoutLog = stdout;
      break;
    }
  }

  return NextResponse.json({
    databaseUrl: dbUrl,
    dbFilePath: filePath,
    dbExists,
    dbSizeBytes: dbSize,
    cwd,
    nodeVersion,
    platform,
    prismaEngineFilename: prismaEngineFilename(),
    prismaEnginePath,
    prismaEngineExists: engineExists,
    prismaStatus,
    prismaError,
    sessionContentCount: recordCount,
    seedGeneratedAt,
    appDataDir: resolvedAppDataDir,
    sidecarLog,
    nextStderrLog,
    nextStdoutLog,
  });
}
