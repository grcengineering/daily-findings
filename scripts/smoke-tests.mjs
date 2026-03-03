#!/usr/bin/env node
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const os = process.argv[2];
const root = process.cwd();

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "pipe", encoding: "utf-8" });
  return { code: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

async function firstFile(dir, extension) {
  const abs = path.join(root, dir);
  const entries = await readdir(abs, { withFileTypes: true });
  const file = entries.find((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(extension));
  return file ? path.join(abs, file.name) : null;
}

async function assertFileHealthy(filePath, label) {
  if (!filePath) throw new Error(`${label} missing`);
  const info = await stat(filePath);
  if (info.size < 1024 * 1024) {
    throw new Error(`${label} looks too small (${info.size} bytes)`);
  }
}

function verifyBundledDatabase(dbPath) {
  const script = `
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.sessionContent
  .count()
  .then((count) => {
    if (!Number.isFinite(count) || count < 1) {
      console.error("SessionContent count is invalid:", count);
      process.exit(2);
    }
    console.log(count);
  })
  .catch((error) => {
    console.error(error?.message || String(error));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
`;
  const result = spawnSync(process.execPath, ["-e", script], {
    stdio: "pipe",
    encoding: "utf-8",
    env: {
      ...process.env,
      DATABASE_URL: `file:${dbPath}`,
    },
  });
  if ((result.status ?? 1) !== 0) {
    throw new Error(`Bundled DB check failed: ${result.stderr || result.stdout}`);
  }
}

async function verifySidecarResources() {
  const sidecarDir = path.join(root, "src-tauri", "resources", "next-standalone");
  const dbCandidates = [
    path.join(sidecarDir, "dev.db"),
    path.join(sidecarDir, "prisma", "dev.db"),
    path.join(sidecarDir, "prisma", "prisma", "dev.db"),
  ];
  const existing = [];
  for (const candidate of dbCandidates) {
    try {
      const info = await stat(candidate);
      existing.push({ path: candidate, size: info.size });
    } catch {
      // candidate does not exist
    }
  }
  if (existing.length === 0) {
    throw new Error(`No bundled sidecar DB found. Checked: ${dbCandidates.join(", ")}`);
  }
  const primary = existing.sort((a, b) => b.size - a.size)[0];
  if (primary.size < 128 * 1024) {
    throw new Error(`Bundled sidecar DB looks too small (${primary.size} bytes): ${primary.path}`);
  }
  verifyBundledDatabase(primary.path);
}

async function runMacSmoke() {
  const dmg = await firstFile("src-tauri/target/release/bundle/dmg", ".dmg");
  await assertFileHealthy(dmg, "DMG");
  await verifySidecarResources();
  const verify = run("hdiutil", ["verify", dmg]);
  if (verify.code !== 0) {
    throw new Error(`DMG verify failed: ${verify.stderr || verify.stdout}`);
  }
}

async function runWindowsSmoke() {
  const exe = await firstFile("src-tauri/target/release/bundle/nsis", ".exe");
  const msi = await firstFile("src-tauri/target/release/bundle/msi", ".msi");
  await assertFileHealthy(exe, "NSIS installer");
  await assertFileHealthy(msi, "MSI installer");
  await verifySidecarResources();
}

async function main() {
  if (os === "macos-latest") {
    await runMacSmoke();
  } else if (os === "windows-latest") {
    await runWindowsSmoke();
  } else {
    throw new Error("Usage: node scripts/smoke-tests.mjs <macos-latest|windows-latest>");
  }
  console.log(`Smoke tests passed for ${os}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
