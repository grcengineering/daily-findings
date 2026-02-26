#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const stagedOnly = process.argv.includes("--staged");

const SECRET_PATTERNS = [
  {
    name: "Anthropic API key",
    regex: /sk-ant-api[0-9A-Za-z_-]{10,}/g,
  },
  {
    name: "OpenAI style key",
    regex: /sk-[A-Za-z0-9]{20,}/g,
  },
  {
    name: "AWS access key",
    regex: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  },
  {
    name: "Google API key",
    regex: /AIza[0-9A-Za-z\-_]{35}/g,
  },
  {
    name: "GitHub personal access token",
    regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g,
  },
  {
    name: "Slack token",
    regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
  },
  {
    name: "Private key block",
    regex: /-----BEGIN (?:RSA|OPENSSH|EC|DSA|PGP|PRIVATE) PRIVATE KEY-----/g,
  },
  {
    name: "Common env key assignment",
    regex:
      /\b(?:ANTHROPIC_API_KEY|OPENAI_API_KEY|GITHUB_TOKEN|AWS_SECRET_ACCESS_KEY)\s*=\s*["']?[^\s"']{12,}/g,
  },
];

function runGit(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function listCandidateFiles() {
  if (stagedOnly) {
    const output = runGit([
      "diff",
      "--cached",
      "--name-only",
      "--diff-filter=ACMRTUXB",
    ]);
    return output ? output.split("\n").filter(Boolean) : [];
  }

  const output = runGit(["ls-files"]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function readFileFromIndex(path) {
  try {
    return execFileSync("git", ["show", `:${path}`], { encoding: "utf8" });
  } catch {
    return "";
  }
}

function isLikelyBinary(text) {
  return text.includes("\u0000");
}

function scanFile(path) {
  const text = stagedOnly ? readFileFromIndex(path) : runGit(["show", `HEAD:${path}`]);
  if (!text || isLikelyBinary(text)) return [];

  const findings = [];
  for (const pattern of SECRET_PATTERNS) {
    const matches = text.match(pattern.regex);
    if (!matches) continue;
    const unique = Array.from(new Set(matches)).slice(0, 3);
    findings.push({
      path,
      kind: pattern.name,
      samples: unique.map((m) => (m.length > 18 ? `${m.slice(0, 8)}...${m.slice(-4)}` : m)),
    });
  }
  return findings;
}

function main() {
  const files = listCandidateFiles();
  const findings = files.flatMap(scanFile);

  if (findings.length === 0) {
    process.exit(0);
  }

  console.error("\nSecret scan failed. Potential secrets detected:\n");
  for (const finding of findings) {
    console.error(`- ${finding.kind} in ${finding.path}`);
    for (const sample of finding.samples) {
      console.error(`  sample: ${sample}`);
    }
  }

  console.error("\nCommit blocked. Remove secrets before committing.\n");
  process.exit(1);
}

main();
