# Daily Findings (GRC Learning Platform)

Daily Findings is a GRC training platform with two runtime modes:

- a `Next.js` web app for development and browser usage
- a `Tauri` desktop wrapper that packages the app as a cross-platform desktop application (macOS and Windows)

The platform delivers daily modules that combine lesson content, scenarios, quizzes, progress tracking, and a news feed.

---

## Install and Go

For most users, the easiest path is to install a prebuilt desktop release (no local toolchains required):

1. Open the latest GitHub Release for this repository.
2. Download your platform installer:
   - macOS: `.dmg`
   - Windows: `.exe` or `.msi`
3. Install and launch.

Only build from source if you are developing. If you do, run:

```bash
npm install
npm run doctor:tauri
npm run tauri:build
```

If `doctor:tauri` fails, it prints exactly what to install next (for example Rust/Cargo or Xcode CLI tools).

---

## Current Scope (Important)

This repository currently ships with the **legacy curriculum shape**:

- **8 domains**
- **15 modules per domain**
- **no capstone modules yet**

That expansion plan to 12 domains / 174 modules is tracked separately and has not been fully applied in this repo yet.

---

## Core Features

- Daily session recommendation based on completion history
- Module library grouped by domain/level with completion status
- Session flow: lesson -> scenario -> quiz
- XP, streak, and badge tracking
- Progress dashboard and history views
- RSS-based GRC news feed with source health/caching metadata
- AI-generated content pipeline with formatting/factual quality checks
- Desktop packaging via Tauri with bundled Node runtime
- Clean-share build mode (ships app with reset learner progress)

---

## Tech Stack

- **Frontend/App**: Next.js 16 (App Router), React 19, TypeScript, Tailwind
- **Desktop**: Tauri v2 (Rust launcher + packaged resources)
- **Database**: SQLite + Prisma ORM
- **Animations/UI**: Framer Motion, Lucide, shadcn/ui patterns
- **AI Content**: Anthropic SDK integration
- **News ingestion**: RSS parser + in-memory caching

---

## Repository Layout

- `src/app/` - Next.js routes/pages
- `src/app/api/` - API route handlers
- `src/components/` - UI components
- `src/lib/` - domain logic and shared utilities
- `data/curriculum.json` - curriculum source loaded by the app
- `prisma/schema.prisma` - DB schema
- `scripts/prepare-tauri-sidecar.mjs` - desktop resource packaging script
- `src-tauri/` - Tauri config, Rust launcher, icons, bundled resources

---

## API Surface (App Router)

- `GET /api/session/today` - returns current recommended session summary
- `GET /api/session/generate` - returns full generated session content
- `POST /api/session/complete` - marks completion, updates progress/streak/xp
- `GET /api/stats` - user stats + recent sessions + domain completion summary
- `GET /api/progress` - deep progress payload + badges + topic progress
- `GET /api/library` - library catalog grouped by domain + level
- `GET /api/news` - news articles + source status + cache metadata

---

## Data Model (Prisma / SQLite)

Primary models:

- `SessionContent` - generated module content by `topicId`
- `SessionCompletion` - completion events (topic/date/score)
- `TopicProgress` - long-term per-topic progress metrics
- `UserStats` - aggregated streak/xp/session stats
- `DailySession` - legacy session table

Schema file: `prisma/schema.prisma`

---

## Environment Variables

Common local variables:

- `DATABASE_URL` (SQLite connection string)
- `ANTHROPIC_API_KEY` (required for AI content generation paths)

Notes:

- local env files are in `.env` / `.env.local`
- avoid committing secrets

---

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Run web app in dev mode:

```bash
npm run dev
```

Default dev URL is typically `http://localhost:3000` unless overridden.

---

## Desktop Development & Build (Tauri)

Before building from source, run:

```bash
npm run doctor:tauri
```

### Desktop dev mode

```bash
npm run tauri:dev
```

### Standard desktop build

```bash
npm run tauri:build
```

### Clean-share desktop build (recommended for distribution)

```bash
npm run tauri:build:clean
```

This build sanitizes learner-progress tables before packaging while preserving generated module content.

---

## Clean-Share Behavior

`tauri:build:clean` sets `TAURI_CLEAN_SHARE_BUILD=1`, which causes the packaging script to reset:

- `SessionCompletion`
- `DailySession`
- `TopicProgress`
- `UserStats`

and keeps:

- `SessionContent`

This gives recipients a fresh learner state but still includes pre-generated modules.

---

## macOS Desktop Packaging Notes

- Built app bundle:
  - `src-tauri/target/release/bundle/macos/Daily Findings.app`
- Built installer:
  - `src-tauri/target/release/bundle/dmg/Daily Findings_0.1.0_aarch64.dmg`

The current artifact is Apple Silicon (`aarch64`) unless an x64 build pipeline is added.

If Finder/Dock icon appears stale after rebuild, quit/reopen app; macOS icon cache may lag.

---

## Windows Distribution

This project can now build Windows desktop installers in GitHub Actions.

- Workflow: `.github/workflows/desktop-build.yml`
- Trigger:
  - manually via **Actions -> Desktop Build (macOS + Windows) -> Run workflow**
  - automatically on tags like `v0.1.1`
- Windows outputs are uploaded as artifacts:
  - `daily-findings-windows` (contains `nsis` and `msi` bundles)

Notes:

- Building Windows bundles from macOS locally is not supported in this setup.
- Use the workflow to generate shareable Windows installers reliably.

---

## Release Process

Desktop builds are produced by an automated workflow that runs a quality gate (lint, curriculum validation, build, QA) before packaging. Releases can be triggered manually or by pushing a version tag (e.g. `v0.1.0`).

- Manual trigger uploads build artifacts to the workflow run.
- Tag trigger (`v*`) uploads artifacts and also publishes a GitHub Release with attached installers and checksums.

For full details, prerequisites, and troubleshooting, see [DISTRIBUTION.md](DISTRIBUTION.md).

---

## Signed vs Unsigned Artifacts

Builds run successfully with or without code signing. When signing secrets are configured, macOS artifacts are notarized and Windows installers are signed. Without them, artifacts are unsigned. Unsigned builds are suitable for internal testing; for public distribution, configure signing to avoid security warnings and gatekeeper prompts. See [DISTRIBUTION.md](DISTRIBUTION.md) for required secrets.

---

## Install Guidance

### macOS

1. Download the DMG from the release artifacts (or the `.app` bundle directly).
2. Open the DMG and drag **Daily Findings** into Applications.
3. On first launch, if macOS blocks the app (unsigned or unverified), open **System Settings → Privacy & Security** and choose **Open Anyway**, or right‑click the app and select **Open**.

### Windows

1. Download the NSIS installer (`.exe`) or MSI package from the release artifacts.
2. Run the installer and follow the prompts.
3. If SmartScreen blocks an unsigned installer, choose **More info** → **Run anyway** (or use a signed build when available).

---

## Checksum Verification

Each release includes a `CHECKSUMS.txt` file (SHA256). To verify a download:

1. Download the bundle artifact and the corresponding checksums artifact.
2. From the project root, regenerate checksums for the extracted bundle directories and compare:

```bash
node scripts/generate-checksums.mjs <bundle-dir1> [bundle-dir2 ...]
diff -u downloaded-checksums.txt CHECKSUMS.txt
```

If the files match, the download is intact. The file paths must match the extracted artifact layout; if you extract to a different location, regenerate from that exact location before comparing.

---

## Versioning Cadence

Versions follow semantic versioning (e.g. `0.1.0`). Release tags use the `v` prefix (e.g. `v0.1.0`). Pushing a tag triggers the desktop build workflow and produces artifacts for that version. There is no fixed schedule; releases are cut as needed.

---

## Troubleshooting

### App looks like an older build

- Kill stale app/sidecar processes and relaunch from `/Applications`.
- Ensure port `1430` is not served by an older process.
- Rebuild with a clean Next output if needed:

```bash
rm -rf .next
npm run tauri:build:clean
```

### Shared build opens with old progress

- Use `npm run tauri:build:clean` (not `tauri:build`) before sharing.

### Desktop build succeeds but DMG step fails

- `.app` can still be installed directly from the macOS bundle path.
- Re-run build if you need fresh `.dmg`.

---

## Security & Privacy

- Do not commit API keys or local secret files.
- Review `.env` handling before first push.
- Validate clean-share artifacts before external distribution.

### Local Pre-Commit Secret Scan

A local pre-commit hook is configured to run:

```bash
node scripts/check-secrets.mjs --staged
```

Behavior:

- scans staged files for common token/key patterns
- blocks commits when possible secrets are detected
- prints a short masked sample so you can identify and remove the leak quickly

If you need to test it manually:

```bash
node scripts/check-secrets.mjs --staged
```

---

## Roadmap Snapshot

Planned but not fully implemented in this repo yet:

- competency-driven expansion to 12 domains / 174 modules
- capstone modules per domain
- module type tagging (`core`, `depth`, `specialization`, `capstone`)
- prerequisite graphing and bridge track logic

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
