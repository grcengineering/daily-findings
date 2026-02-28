#!/usr/bin/env node
import { writeFile } from "node:fs/promises";

const metadata = {
  version: process.env.npm_package_version ?? "0.1.0",
  signed: process.env.RELEASE_SIGNED === "true",
  notarized: process.env.RELEASE_NOTARIZED === "true",
  builtAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
};

await writeFile("release-metadata.json", `${JSON.stringify(metadata, null, 2)}\n`, "utf-8");
console.log("release-metadata.json generated");
