# Distribution Runbook

Release runbook for Daily Findings desktop builds (macOS + Windows). For install guidance, checksum verification, and versioning, see [README.md](README.md#release-process).

## Prerequisites

- GitHub Actions enabled for the repository
- Node 20, npm, Rust toolchain (handled by workflow)
- For signing/notarization (optional): Apple Developer account, Windows code signing certificate

## Workflow Trigger

- **Manual**: Actions → Desktop Build (macOS + Windows) → Run workflow
- **Automatic**: Push a tag matching `v*` (e.g. `v0.1.0`)
- **Release publish**: Tag-triggered runs create a GitHub Release and attach installers plus checksum files.

## Secrets (Optional)

Set these in Settings → Secrets and variables → Actions to enable signing/notarization. The workflow runs successfully without them (unsigned builds).

| Secret | Platform | Purpose |
|--------|----------|---------|
| `APPLE_CERTIFICATE` | macOS | Base64-encoded Developer ID Application certificate (`.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | Password for the Developer ID certificate |
| `APPLE_SIGNING_IDENTITY` | macOS | Certificate identity name used by codesign/Tauri |
| `APPLE_ID` | macOS | Apple Developer account email |
| `APPLE_TEAM_ID` | macOS | Apple Developer Team ID |
| `APPLE_APP_SPECIFIC_PASSWORD` | macOS | App-specific password for notarization |
| `WIN_SIGN_CERT` | Windows | Base64-encoded code signing certificate |
| `WIN_SIGN_PASSWORD` | Windows | Password for the Windows code-signing certificate |
| `WIN_TIMESTAMP_URL` | Windows | Optional RFC3161 timestamp URL override |

## Quality Gate

Before desktop builds run, a quality-gate job on `ubuntu-latest` executes:

1. `npm ci`
2. `npm run lint`
3. `npm run curriculum:validate`
4. `npm run build` → start server → `npm run qa`

Desktop jobs (`build-desktop`) run only if the quality gate passes.

## Artifacts

After a successful run:

- **daily-findings-macos** / **daily-findings-windows**: Bundle files (app, dmg, nsis, msi)
- **daily-findings-macos-checksums** / **daily-findings-windows-checksums**: `CHECKSUMS.txt` (SHA256)

## Artifact Verification

1. Download the bundle artifact and checksums artifact.
2. Verify checksums:
   ```bash
   node scripts/generate-checksums.mjs src-tauri/target/release/bundle/macos src-tauri/target/release/bundle/dmg
   diff -u downloaded-checksums.txt CHECKSUMS.txt
   ```
3. Verify build structure:
   ```bash
   node scripts/verify-build.mjs macos-latest   # or windows-latest
   ```
4. If you extract artifacts to a different folder structure, run checksum generation from that exact extracted layout before comparing.
5. For signed builds, CI also verifies signatures:
   - macOS: `codesign --verify --deep --strict`
   - Windows: `signtool verify /pa`

## Troubleshooting

| Issue | Action |
|-------|--------|
| Quality gate fails on lint | Fix ESLint errors locally with `npm run lint` |
| Curriculum validation fails | Run `npm run curriculum:validate` and fix schema/content issues |
| QA script fails | Ensure app builds and runs; check `qa-artifacts/playwright-qa-report.json` |
| Build artifacts missing | Check `scripts/verify-build.mjs` required paths match Tauri output |
| Checksum generation fails | Ensure bundle directories exist and contain files before the step runs |
