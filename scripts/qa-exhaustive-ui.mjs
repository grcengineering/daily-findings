import { chromium } from "playwright";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3199";
const DB_PATH = process.env.QA_DB_PATH ?? path.join(process.cwd(), "prisma", "dev.db");
const OUT_DIR = path.join(process.cwd(), "qa-artifacts", "exhaustive");
const HTTP_TIMEOUT_MS = 15000;
const LINK_CONCURRENCY = 12;

const STATIC_ROUTES = [
  "/",
  "/library",
  "/progress",
  "/history",
  "/news",
  "/about",
  "/diagnostics",
  "/session",
];

const TYPO_PATTERNS = [
  /\bteh\b/i,
  /\brecieve\b/i,
  /\boccured\b/i,
  /\brequirments\b/i,
  /\bseperate\b/i,
  /\bdefinately\b/i,
  /\bgoverance\b/i,
  /\bimplmentation\b/i,
  /\bcomliance\b/i,
];

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase();
}

function normalizeLink(href) {
  if (!href) return null;
  const value = href.trim();
  if (!/^https?:\/\//i.test(value)) return null;
  return value;
}

async function getTopicIds() {
  const { stdout } = await execFileAsync("sqlite3", [
    DB_PATH,
    "select topicId from SessionContent order by topicId;",
  ]);
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

async function collectSignals(page) {
  const payload = await page.evaluate(() => {
    const bodyText = document.body?.innerText || "";
    const links = Array.from(document.querySelectorAll("a[href]"))
      .map((a) => a.getAttribute("href") || "")
      .filter(Boolean);
    const images = Array.from(document.images).map((img) => ({
      src: img.currentSrc || img.src || "",
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
    }));
    const brokenImages = images.filter(
      (img) => img.src && (img.naturalWidth === 0 || img.naturalHeight === 0),
    );
    const tinyImages = images.filter(
      (img) => img.clientWidth > 0 && (img.clientWidth < 32 || img.clientHeight < 32),
    );
    const enlargeButtons = Array.from(document.querySelectorAll("button, a, [role='button']"))
      .map((el) => (el.textContent || "").trim())
      .filter((t) => /enlarge|normal size|zoom|fullscreen|full screen/i.test(t));
    const ttsVoice = document.querySelector('[aria-label="Text-to-speech voice"]');
    const ttsSpeed = document.querySelector('[aria-label="Text-to-speech speed"]');
    const readAloud = Array.from(document.querySelectorAll("button")).find((b) =>
      /read aloud/i.test(b.textContent || ""),
    );
    const ttsPresent = !!(ttsVoice || ttsSpeed || readAloud);
    const ttsVoiceOptions = ttsVoice ? ttsVoice.querySelectorAll("option").length : 0;
    return {
      bodyText,
      links,
      imageCount: images.length,
      brokenImagesCount: brokenImages.length,
      tinyImagesCount: tinyImages.length,
      enlargeButtonsCount: enlargeButtons.length,
      ttsPresent,
      ttsVoiceOptions,
    };
  });

  const typoMatches = TYPO_PATTERNS.filter((pattern) => pattern.test(payload.bodyText)).map(
    (pattern) => String(pattern),
  );

  const normalizedLinks = payload.links.map(normalizeLink).filter(Boolean);
  return { ...payload, typoMatches, links: normalizedLinks };
}

async function toggleEnlargeIfPresent(page) {
  const btn = page
    .locator("button, a, [role='button']")
    .filter({ hasText: /enlarge|normal size|zoom/i })
    .first();
  const visible = await btn.isVisible().catch(() => false);
  if (!visible) return { attempted: false, ok: null };

  try {
    const before = ((await btn.textContent().catch(() => "")) || "").toLowerCase();
    await btn.click({ timeout: 3000 });
    await page.waitForTimeout(250);
    const after = ((await btn.textContent().catch(() => "")) || "").toLowerCase();
    const changed = before !== after;
    await btn.click({ timeout: 3000 }).catch(() => {});
    return { attempted: true, ok: changed };
  } catch {
    return { attempted: true, ok: false };
  }
}

async function advanceSession(page, maxSteps = 20) {
  const steps = [];
  for (let i = 0; i < maxSteps; i++) {
    const runCheck = page.getByRole("button", { name: /run check/i }).first();
    if (await runCheck.isVisible().catch(() => false)) {
      await runCheck.click().catch(() => {});
      steps.push("run-check");
      await page.waitForTimeout(150);
    }

    const answerButton = page.getByRole("button", { name: /^[A-D]\b/i }).first();
    if (await answerButton.isVisible().catch(() => false)) {
      await answerButton.click().catch(() => {});
      steps.push("answer");
      await page.waitForTimeout(150);
    }

    const next = page
      .getByRole("button", {
        name: /start session|next|continue|see results|complete session|complete capstone|back to dashboard/i,
      })
      .first();
    if (!(await next.isVisible().catch(() => false))) break;
    const label = (await next.textContent().catch(() => "next")) || "next";
    await next.click().catch(() => {});
    steps.push(`click:${label.trim().toLowerCase()}`);
    await page.waitForTimeout(250);
  }
  return steps;
}

async function validateLinks(uniqueLinks) {
  const results = [];
  const queue = [...uniqueLinks];

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift();
      if (!url) continue;

      try {
        let method = "HEAD";
        let status = 0;
        let ok = false;

        const head = await execFileAsync("curl", [
          "-I",
          "-L",
          "-s",
          "-o",
          "/dev/null",
          "-w",
          "%{http_code}",
          "--max-time",
          String(Math.floor(HTTP_TIMEOUT_MS / 1000)),
          url,
        ]);
        status = Number((head.stdout || "").trim()) || 0;
        ok = status >= 200 && status < 400;

        if (!ok || status === 405 || status === 403) {
          method = "GET";
          const get = await execFileAsync("curl", [
            "-L",
            "-s",
            "-o",
            "/dev/null",
            "-w",
            "%{http_code}",
            "--max-time",
            String(Math.floor(HTTP_TIMEOUT_MS / 1000)),
            url,
          ]);
          status = Number((get.stdout || "").trim()) || 0;
          ok = status >= 200 && status < 400;
        }

        results.push({ url, ok, status: status || null, method, error: null });
      } catch (error) {
        results.push({
          url,
          ok: false,
          status: null,
          method: "curl",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  const workers = Array.from({ length: LINK_CONCURRENCY }, () => worker());
  await Promise.all(workers);
  return results;
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const topicIds = await getTopicIds();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
  const page = await context.newPage();

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    staticRoutes: [],
    topics: [],
    citations: { uniqueCount: 0, checkedCount: 0, failures: [] },
    summary: {
      staticRouteFailures: 0,
      topicFailures: 0,
      topicCount: topicIds.length,
    },
  };

  const allLinks = new Set();

  for (const route of STATIC_ROUTES) {
    const entry = { route, ok: true, issues: [], warnings: [] };
    try {
      const res = await page.goto(`${BASE_URL}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(900);
      if (!res || res.status() >= 400) entry.issues.push(`HTTP ${res?.status() ?? "unknown"}`);

      const signals = await collectSignals(page);
      signals.links.forEach((href) => allLinks.add(href));
      if (/application error: a client-side exception/i.test(signals.bodyText)) {
        entry.issues.push("Client-side exception rendered");
      }
      if (signals.typoMatches.length > 0) {
        entry.issues.push(`Potential typos: ${signals.typoMatches.join(", ")}`);
      }
      if (signals.brokenImagesCount > 0) entry.issues.push(`Broken images: ${signals.brokenImagesCount}`);
      if (signals.tinyImagesCount > 0) entry.warnings.push(`Tiny images: ${signals.tinyImagesCount}`);

      entry.signals = {
        imageCount: signals.imageCount,
        ttsPresent: signals.ttsPresent,
        ttsVoiceOptions: signals.ttsVoiceOptions,
      };
      await page.screenshot({
        path: path.join(OUT_DIR, `route-${slugify(route || "root")}.png`),
        fullPage: true,
      });
    } catch (error) {
      entry.ok = false;
      entry.issues.push(error instanceof Error ? error.message : String(error));
    }

    if (entry.issues.length > 0 || !entry.ok) report.summary.staticRouteFailures += 1;
    report.staticRoutes.push(entry);
  }

  for (let i = 0; i < topicIds.length; i++) {
    const topicId = topicIds[i];
    const entry = {
      topicId,
      ok: true,
      issues: [],
      warnings: [],
      steps: [],
      tts: null,
      enlarge: null,
      imageCount: 0,
      linksCount: 0,
    };

    try {
      const res = await page.goto(
        `${BASE_URL}/session?topicId=${encodeURIComponent(topicId)}&overridePrereq=1`,
        {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        },
      );
      await page.waitForTimeout(900);
      if (!res || res.status() >= 400) entry.issues.push(`HTTP ${res?.status() ?? "unknown"}`);

      const startSignals = await collectSignals(page);
      startSignals.links.forEach((href) => allLinks.add(href));
      entry.imageCount += startSignals.imageCount;
      entry.linksCount += startSignals.links.length;
      if (startSignals.typoMatches.length > 0) {
        entry.issues.push(`Potential typos: ${startSignals.typoMatches.join(", ")}`);
      }
      if (startSignals.brokenImagesCount > 0) {
        entry.issues.push(`Broken images: ${startSignals.brokenImagesCount}`);
      }
      if (startSignals.tinyImagesCount > 0) {
        entry.warnings.push(`Tiny images: ${startSignals.tinyImagesCount}`);
      }
      entry.tts = {
        present: startSignals.ttsPresent,
        voiceOptions: startSignals.ttsVoiceOptions,
      };

      const enlarge = await toggleEnlargeIfPresent(page);
      entry.enlarge = enlarge;
      if (enlarge.attempted && enlarge.ok === false) {
        entry.issues.push("Enlarge/zoom control failed toggle");
      }

      entry.steps = await advanceSession(page, 20);
      const endSignals = await collectSignals(page);
      endSignals.links.forEach((href) => allLinks.add(href));
      entry.imageCount += endSignals.imageCount;
      entry.linksCount += endSignals.links.length;
      if (/application error: a client-side exception/i.test(endSignals.bodyText)) {
        entry.issues.push("Client-side exception rendered");
      }
      if (endSignals.brokenImagesCount > 0) {
        entry.issues.push(`Broken images after flow: ${endSignals.brokenImagesCount}`);
      }

      await page.screenshot({
        path: path.join(OUT_DIR, `topic-${String(i + 1).padStart(3, "0")}-${slugify(topicId)}.png`),
        fullPage: true,
      });
    } catch (error) {
      entry.ok = false;
      entry.issues.push(error instanceof Error ? error.message : String(error));
    }

    if (!entry.ok || entry.issues.length > 0) report.summary.topicFailures += 1;
    report.topics.push(entry);
  }

  const uniqueLinks = Array.from(allLinks).sort();
  report.citations.uniqueCount = uniqueLinks.length;
  const linkResults = await validateLinks(uniqueLinks);
  report.citations.checkedCount = linkResults.length;
  report.citations.failures = linkResults.filter((r) => !r.ok);

  await writeFile(
    path.join(OUT_DIR, "exhaustive-ui-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf-8",
  );
  await writeFile(
    path.join(OUT_DIR, "citation-link-results.json"),
    `${JSON.stringify(linkResults, null, 2)}\n`,
    "utf-8",
  );

  await browser.close();

  console.log(`Static routes checked: ${report.staticRoutes.length}`);
  console.log(`Topics checked: ${report.topics.length}`);
  console.log(`Unique citation links checked: ${report.citations.checkedCount}`);
  console.log(
    `Failures -> static: ${report.summary.staticRouteFailures}, topics: ${report.summary.topicFailures}, links: ${report.citations.failures.length}`,
  );

  if (
    report.summary.staticRouteFailures > 0 ||
    report.summary.topicFailures > 0 ||
    report.citations.failures.length > 0
  ) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
