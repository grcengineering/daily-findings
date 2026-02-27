#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const tauriMode = args.has("--tauri");

function run(cmd, cmdArgs = []) {
  try {
    return {
      ok: true,
      output: execFileSync(cmd, cmdArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim(),
    };
  } catch (error) {
    return {
      ok: false,
      output: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkNode() {
  const result = run("node", ["-v"]);
  if (!result.ok) {
    return { ok: false, message: "Node.js not found. Install Node 20+ from https://nodejs.org/" };
  }
  const major = Number((result.output.match(/\d+/) || ["0"])[0]);
  if (!Number.isFinite(major) || major < 20) {
    return { ok: false, message: `Detected ${result.output}. Please use Node 20+.` };
  }
  return { ok: true, message: `Node.js ${result.output}` };
}

function checkCargo() {
  const cargo = run("cargo", ["--version"]);
  const rustc = run("rustc", ["--version"]);
  if (!cargo.ok || !rustc.ok) {
    return {
      ok: false,
      message:
        "Rust/Cargo not found. Install Rust with:\n" +
        "  curl https://sh.rustup.rs -sSf | sh -s -- -y\n" +
        "Then reload shell:\n" +
        "  source \"$HOME/.cargo/env\"",
    };
  }
  return { ok: true, message: `${cargo.output} | ${rustc.output}` };
}

function checkXcodeCliTools() {
  if (process.platform !== "darwin") {
    return { ok: true, message: "Xcode check skipped (not macOS)." };
  }
  const result = run("xcode-select", ["-p"]);
  if (!result.ok) {
    return {
      ok: false,
      message:
        "Xcode Command Line Tools missing. Install with:\n" +
        "  xcode-select --install",
    };
  }
  return { ok: true, message: `Xcode CLI tools: ${result.output}` };
}

const checks = [checkNode];
if (tauriMode) {
  checks.push(checkCargo, checkXcodeCliTools);
}

let failed = false;
console.log(`Running preflight checks${tauriMode ? " (Tauri)" : ""}...`);
for (const check of checks) {
  const result = check();
  if (result.ok) {
    console.log(`✓ ${result.message}`);
  } else {
    failed = true;
    console.error(`✗ ${result.message}`);
  }
}

if (failed) {
  process.exit(1);
}

