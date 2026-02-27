#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const dmgDir = path.join(root, "src-tauri", "target", "release", "bundle", "dmg");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function runOrThrow(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? "unknown"}`);
  }
}

async function findDmg() {
  const entries = await readdir(dmgDir, { withFileTypes: true });
  const dmg = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".dmg"))
    .map((entry) => path.join(dmgDir, entry.name))
    .sort()
    .at(-1);

  if (!dmg) {
    throw new Error(`No DMG file found in ${dmgDir}`);
  }
  return dmg;
}

async function main() {
  const appleId = requireEnv("APPLE_ID");
  const appleTeamId = requireEnv("APPLE_TEAM_ID");
  const appPassword = requireEnv("APPLE_APP_SPECIFIC_PASSWORD");
  const dmgPath = await findDmg();

  console.log(`Notarizing ${path.basename(dmgPath)} ...`);
  runOrThrow("xcrun", [
    "notarytool",
    "submit",
    dmgPath,
    "--apple-id",
    appleId,
    "--team-id",
    appleTeamId,
    "--password",
    appPassword,
    "--wait",
  ]);

  console.log("Stapling notarization ticket ...");
  runOrThrow("xcrun", ["stapler", "staple", dmgPath]);
  console.log("Notarization completed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
