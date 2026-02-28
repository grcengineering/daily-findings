import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

async function readReleaseMetadata() {
  const candidate = path.join(process.cwd(), "release-metadata.json");
  try {
    const raw = await fs.readFile(candidate, "utf-8");
    return JSON.parse(raw) as {
      version?: string;
      signed?: boolean;
      notarized?: boolean;
      builtAt?: string;
      commit?: string;
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const metadata = await readReleaseMetadata();
  return NextResponse.json({
    appName: "Daily Findings",
    version: process.env.npm_package_version ?? metadata?.version ?? "0.1.0",
    signed: metadata?.signed ?? false,
    notarized: metadata?.notarized ?? false,
    builtAt: metadata?.builtAt ?? null,
    commit: metadata?.commit ?? null,
  });
}
