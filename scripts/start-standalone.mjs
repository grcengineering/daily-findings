import { access, cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const standaloneServer = path.join(standaloneDir, "server.js");
const staticSource = path.join(root, ".next", "static");
const staticTarget = path.join(standaloneDir, ".next", "static");
const publicSource = path.join(root, "public");
const publicTarget = path.join(standaloneDir, "public");

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureStandaloneAssets() {
  if (!(await exists(standaloneServer))) {
    throw new Error(
      "Missing .next/standalone/server.js. Run `npm run build` before starting standalone."
    );
  }

  if (await exists(staticSource)) {
    await mkdir(path.dirname(staticTarget), { recursive: true });
    await cp(staticSource, staticTarget, { recursive: true, force: true });
  }

  if (await exists(publicSource)) {
    await cp(publicSource, publicTarget, { recursive: true, force: true });
  }
}

function normalizeDatabaseUrl() {
  const raw = process.env.DATABASE_URL;
  if (!raw || !raw.startsWith("file:")) {
    process.env.DATABASE_URL = `file:${path.join(root, "prisma", "dev.db")}`;
    return;
  }

  const filePart = raw.slice("file:".length);
  if (!filePart.startsWith("./")) return;
  process.env.DATABASE_URL = `file:${path.resolve(root, filePart)}`;
}

async function main() {
  await ensureStandaloneAssets();
  normalizeDatabaseUrl();

  process.env.HOSTNAME = process.env.HOSTNAME || "127.0.0.1";
  process.env.PORT = process.env.PORT || "3199";

  const child = spawn(process.execPath, [standaloneServer], {
    cwd: standaloneDir,
    env: process.env,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
