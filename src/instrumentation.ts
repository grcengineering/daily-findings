import type { ReleasePayload } from "@/lib/seed-release-library";

/**
 * Next.js boot hook. Runs once per server process — both in the
 * standalone Tauri sidecar and in `next start`.
 *
 * Responsibility: reconcile the user's SQLite `SessionContent` table
 * against the bundled release snapshot at
 * `data/release-library/session-content.json` so that fresh installs and
 * upgrades both end up with the full curriculum visible, while existing
 * user progress (XP, streaks, completions, capstone state, analytics,
 * reading positions) is preserved.
 *
 * Skips when `DAILY_FINDINGS_SKIP_SEED=1` (used by some test contexts).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.DAILY_FINDINGS_SKIP_SEED === "1") return;

  try {
    const { prisma } = await import("@/lib/db");
    // NOTE: intentionally use the bare module specifiers ("fs/promises",
    // "path") here — NOT the "node:" scheme. Turbopack's standalone build
    // emits an externals chunk whose filename is derived from the specifier,
    // and "node:fs/promises" produces a chunk named
    // `[externals]_node:fs_promises_*.js`. The ':' is illegal on Windows
    // (NTFS reserves it for Alternate Data Streams), which causes
    // `next build` to fail on windows-latest with
    // `EINVAL: invalid argument, copyfile ... .next/standalone/...`
    // when copying chunks into .next/standalone. Dropping the scheme keeps
    // the same Node builtin target while producing a colon-free chunk name.
    const { readFile } = await import("fs/promises");
    const path = await import("path");
    const {
      seedReleaseLibrary,
      snapshotIsNewer,
      recordSeedGeneratedAt,
    } = await import("@/lib/seed-release-library");

    const candidates = [
      path.join(process.cwd(), "data", "release-library", "session-content.json"),
      path.join(
        process.cwd(),
        "..",
        "..",
        "data",
        "release-library",
        "session-content.json"
      ),
    ];

    let raw: string | null = null;
    let resolvedPath: string | null = null;
    for (const candidate of candidates) {
      try {
        raw = await readFile(candidate, "utf-8");
        resolvedPath = candidate;
        break;
      } catch {
        // try next
      }
    }

    if (!raw) {
      console.warn(
        "[instrumentation] release snapshot not found in expected locations; skipping reseed",
        candidates
      );
      return;
    }

    const payload = JSON.parse(raw) as ReleasePayload;
    const newer = await snapshotIsNewer(prisma, payload);
    if (!newer) {
      console.log(
        `[instrumentation] release snapshot ${payload.generatedAt} already applied; skipping reseed`
      );
      return;
    }

    console.log(
      `[instrumentation] applying release snapshot ${payload.generatedAt} from ${resolvedPath}`
    );
    const result = await seedReleaseLibrary(prisma, payload);
    await recordSeedGeneratedAt(prisma, result.generatedAt);
    console.log(
      `[instrumentation] seed complete — removed=${result.removed} created=${result.created} updated=${result.updated} total=${result.total}`
    );
  } catch (err) {
    // Never crash the server on seed failure — the UI will still come up
    // and the diagnostics endpoint will surface the issue.
    console.error("[instrumentation] release snapshot reconciliation failed", err);
  }
}
