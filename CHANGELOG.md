# Changelog

All notable changes to Daily Findings are documented here. The project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html) and release tags use
the `v` prefix (e.g. `v0.2.8`).

## v0.2.8 – Fresh-install lesson population reliability

The headline goal of this release is "fresh installs always show all lessons".
A series of compounding bugs in the desktop sidecar combined to leave fresh
macOS installers stuck on "Loading..." with an empty library. This release
fixes the root causes and hardens the sidecar.

### Fixed – desktop sidecar boot reliability

- **macOS Gatekeeper / hardened runtime entitlements** – the bundled Node
  runtime (`node-runtime/bin/node`) is now signed with explicit
  `com.apple.security.cs.allow-jit`,
  `com.apple.security.cs.allow-unsigned-executable-memory`, and
  `com.apple.security.cs.disable-library-validation` entitlements so V8's JIT
  works and Prisma's native query engine can be loaded. Previously amfid
  silently killed the sidecar on first launch and the WebView hung on
  `http://127.0.0.1:1430`.
- **Sidecar now captures stdout** – the Rust launcher previously redirected
  only `stderr` to `next-stderr.log`. Boot messages, instrumentation logs and
  Prisma engine init were dropped. We now also write `next-stdout.log`.
- **`ensure_writable_db` no longer overwrites your data** – the previous
  size-based comparison either silently dropped new content (when your local
  DB outgrew the bundled seed) or wiped your XP/streaks/completions when it
  did copy. The Rust launcher now copies the bundled seed only when no user
  DB exists. Content updates are reconciled at the application layer.
- **Content-versioned reseed via `src/instrumentation.ts`** – a Next.js boot
  hook compares the bundled `data/release-library/session-content.json`
  `generatedAt` field against the new `UserStats.seedGeneratedAt` column and
  upserts `SessionContent` rows in place when newer. User progress
  (`UserStats`, `TopicProgress`, `SessionCompletion`, `ReadingPosition`,
  `CapstoneRubricState`, `QuestionAnalytics`) is preserved across upgrades.
- **Stale duplicate `dev.db` files pruned from the bundle** –
  `scripts/prepare-tauri-sidecar.mjs` now removes the empty `prisma/dev.db`
  and `prisma/prisma/dev.db` copies that Next standalone trace pulled in,
  enforces a >1 MB sanity check on the canonical seed, and the Rust
  `find_bundled_db` only consults a single canonical path.
- **macOS quarantine self-heal** – on macOS the Rust launcher runs
  `xattr -dr com.apple.quarantine` against its own `.app` bundle on startup,
  rescuing users who downloaded via Safari without right-click → Open.

### Fixed – correctness and security

- **`stripHtml` regression in `/api/news`** – reapplied the do-while tag
  strip and safe entity decode order. Closes the previously merged CodeQL
  alert that had silently regressed.
- **`firstTryCorrect` analytics** – the increment in
  `/api/session/complete` was guarded by `&& !existing` inside the `update`
  branch, which only runs when the row already exists. The counter never
  incremented. Now it does.
- **`kill_stale_port_holder` no longer nukes unrelated dev servers** – the
  Rust launcher checks the holder of port 1430 with `ps`/`tasklist` and
  refuses to `kill -9` anything that is not a Node process, instead
  surfacing a clear error.
- **`toKeyTerms` keeps short acronyms** – the `length > 2` filter dropped
  "AI", "GRC", "ISO", "SOC". Now uses `length >= 2` and a small stopword
  list. `npm run curriculum:validate` enforces that `AI Governance` etc.
  retain their acronyms.

### Improved

- **`/api/diagnostics` is now platform-aware** – Prisma engine filename and
  app data dir paths are derived from `process.platform` and
  `process.arch`. Surfaces the new `next-stdout.log`, `seedGeneratedAt`,
  and resolved `appDataDir`.
- Shared seed logic extracted to `src/lib/seed-release-library.ts` so the
  build-time `npm run library:seed:release` script and runtime
  instrumentation hook stay in lockstep.

### Schema

- Added nullable `UserStats.seedGeneratedAt String?`. Backwards compatible
  with existing user databases — populated by the instrumentation hook on
  the next launch.

## v0.2.7 – Build/release plumbing

- Replaced `step-security/action-gh-release` with
  `softprops/action-gh-release` so unsigned tag releases publish reliably.

## v0.2.6 and earlier

See `git log` and the GitHub Releases page for prior history.
