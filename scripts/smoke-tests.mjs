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

async function runMacSmoke() {
  const dmg = await firstFile("src-tauri/target/release/bundle/dmg", ".dmg");
  await assertFileHealthy(dmg, "DMG");
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
