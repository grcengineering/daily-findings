#!/usr/bin/env node
/**
 * Verifies required bundle output directories/files exist for macOS or Windows.
 * Exits non-zero if any required artifact is missing.
 *
 * Usage: node scripts/verify-build.mjs <macos-latest|windows-latest>
 */

import { readdir, access } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

const REQUIRED = {
  "macos-latest": [
    {
      dir: "src-tauri/target/release/bundle/dmg",
      extensions: [".dmg"],
    },
  ],
  "windows-latest": [
    {
      dir: "src-tauri/target/release/bundle/nsis",
      extensions: [".exe"],
    },
    {
      dir: "src-tauri/target/release/bundle/msi",
      extensions: [".msi"],
    },
  ],
};

async function dirExists(dir) {
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

async function dirHasFiles(dir, extensions) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.some(
      (e) =>
        e.isFile() &&
        extensions.some((extension) => e.name.toLowerCase().endsWith(extension))
    );
  } catch {
    return false;
  }
}

async function main() {
  const os = process.argv[2];
  if (!os || !REQUIRED[os]) {
    console.error("Usage: node scripts/verify-build.mjs <macos-latest|windows-latest>");
    process.exit(1);
  }

  const dirs = REQUIRED[os];
  const missing = [];

  for (const requirement of dirs) {
    const abs = path.join(root, requirement.dir);
    if (!(await dirExists(abs))) {
      missing.push(`Directory missing: ${requirement.dir}`);
    } else if (!(await dirHasFiles(abs, requirement.extensions))) {
      missing.push(
        `No ${requirement.extensions.join(", ")} files found in: ${requirement.dir}`
      );
    }
  }

  if (missing.length > 0) {
    console.error("Build verification failed:");
    missing.forEach((m) => console.error(`  - ${m}`));
    process.exit(1);
  }

  console.log(`Verified ${dirs.length} bundle directories for ${os}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
