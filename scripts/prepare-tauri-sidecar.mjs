import { cp, mkdir, rm, access, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = process.cwd();
const standaloneDir = path.join(root, ".next", "standalone");
const staticDir = path.join(root, ".next", "static");
const publicDir = path.join(root, "public");
const sqliteDb = path.join(root, "prisma", "dev.db");
const targetDir = path.join(root, "src-tauri", "resources", "next-standalone");
const targetStaticDir = path.join(targetDir, ".next", "static");
const resourcesDir = path.join(root, "src-tauri", "resources");
const nodeRuntimeDir = path.join(resourcesDir, "node-runtime");
const execFileAsync = promisify(execFile);
const nodeVersion = process.env.TAURI_NODE_VERSION || "v20.19.0";
const cleanShareBuild = process.env.TAURI_CLEAN_SHARE_BUILD === "1";

async function exists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function resolveNodeArchive() {
  if (process.platform !== "darwin") {
    throw new Error(
      `Unsupported platform ${process.platform}. This script currently packages Node for macOS only.`
    );
  }

  const arch = process.arch === "arm64" ? "arm64" : process.arch === "x64" ? "x64" : null;
  if (!arch) {
    throw new Error(`Unsupported architecture ${process.arch} for bundled Node runtime.`);
  }

  const archiveName = `node-${nodeVersion}-darwin-${arch}.tar.gz`;
  return {
    archiveName,
    url: `https://nodejs.org/dist/${nodeVersion}/${archiveName}`,
    extractedFolderName: `node-${nodeVersion}-darwin-${arch}`,
  };
}

async function prepareBundledNodeRuntime() {
  const bundledNodeBin = path.join(nodeRuntimeDir, "bin", "node");
  if (await exists(bundledNodeBin)) {
    return;
  }

  const { archiveName, url, extractedFolderName } = resolveNodeArchive();
  const cacheDir = path.join(root, ".cache", "tauri-node-runtime");
  const archivePath = path.join(cacheDir, archiveName);
  const extractRoot = path.join(cacheDir, "extract");
  const extractedDir = path.join(extractRoot, extractedFolderName);

  await mkdir(cacheDir, { recursive: true });
  await mkdir(extractRoot, { recursive: true });

  if (!(await exists(archivePath))) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download Node runtime: ${response.status} ${response.statusText}`);
    }
    const data = new Uint8Array(await response.arrayBuffer());
    await writeFile(archivePath, data);
  }

  await rm(extractedDir, { recursive: true, force: true });
  await execFileAsync("tar", ["-xzf", archivePath, "-C", extractRoot]);

  await rm(nodeRuntimeDir, { recursive: true, force: true });
  await cp(extractedDir, nodeRuntimeDir, { recursive: true });
  await chmod(path.join(nodeRuntimeDir, "bin", "node"), 0o755);
}

async function sanitizeDatabaseForCleanShare(dbPath) {
  const resetSql = [
    "DELETE FROM SessionCompletion;",
    "DELETE FROM DailySession;",
    "DELETE FROM TopicProgress;",
    "DELETE FROM UserStats;",
    "VACUUM;",
  ].join(" ");

  await execFileAsync("sqlite3", [dbPath, resetSql]);
}

async function main() {
  if (!(await exists(standaloneDir))) {
    throw new Error(
      "Missing .next/standalone. Run `npm run build` before preparing Tauri resources."
    );
  }

  await rm(targetDir, { recursive: true, force: true });
  await mkdir(targetDir, { recursive: true });
  await cp(standaloneDir, targetDir, { recursive: true });

  if (await exists(staticDir)) {
    await mkdir(path.dirname(targetStaticDir), { recursive: true });
    await cp(staticDir, targetStaticDir, { recursive: true });
  }

  if (await exists(publicDir)) {
    await cp(publicDir, path.join(targetDir, "public"), { recursive: true });
  }

  if (await exists(sqliteDb)) {
    const targetDb = path.join(targetDir, "dev.db");
    await cp(sqliteDb, targetDb);
    if (cleanShareBuild) {
      await sanitizeDatabaseForCleanShare(targetDb);
    }
  }

  await mkdir(resourcesDir, { recursive: true });
  await prepareBundledNodeRuntime();
  console.log("Prepared Tauri sidecar resources at src-tauri/resources/next-standalone");
  console.log("Prepared bundled Node runtime at src-tauri/resources/node-runtime");
  if (cleanShareBuild) {
    console.log("Sanitized share database snapshot for clean build");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
