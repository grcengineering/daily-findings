#!/usr/bin/env node
/**
 * Computes SHA256 checksums for files in the provided directories
 * and writes CHECKSUMS.txt in the project root.
 *
 * Usage: node scripts/generate-checksums.mjs <dir1> [dir2 ...]
 */

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outPath = path.join(root, "CHECKSUMS.txt");

async function* walkFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* walkFiles(full);
    } else if (e.isFile()) {
      yield full;
    }
  }
}

async function sha256(filePath) {
  const data = await readFile(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function main() {
  const dirs = process.argv.slice(2).filter(Boolean);
  if (dirs.length === 0) {
    console.error("Usage: node scripts/generate-checksums.mjs <dir1> [dir2 ...]");
    process.exit(1);
  }

  const lines = [];

  for (const rel of dirs) {
    const abs = path.join(root, rel);
    try {
      const s = await stat(abs);
      if (!s.isDirectory()) continue;
    } catch {
      continue;
    }

    for await (const file of walkFiles(abs)) {
      const relFile = path.relative(root, file);
      const hash = await sha256(file);
      lines.push(`${hash}  ${relFile}`);
    }
  }

  if (lines.length === 0) {
    console.error("No files found in specified directories");
    process.exit(1);
  }

  lines.sort((a, b) => {
    const pathA = a.split(/\s{2,}/)[1] ?? "";
    const pathB = b.split(/\s{2,}/)[1] ?? "";
    return pathA.localeCompare(pathB);
  });

  await writeFile(outPath, lines.join("\n") + "\n", "utf-8");
  console.log(`Wrote ${lines.length} checksums to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
