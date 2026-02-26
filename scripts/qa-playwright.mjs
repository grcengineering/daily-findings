import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = "http://127.0.0.1:3199";
const OUT_DIR = path.join(process.cwd(), "qa-artifacts");
const TYPO_PATTERNS = [
  /\bteh\b/i,
  /\brecieve\b/i,
  /\boccured\b/i,
  /\brequirments\b/i,
  /\bwronhg\b/i,
  /\bti does\b/i,
];

const PAGES = [
  "/",
  "/library",
  "/progress",
  "/history",
  "/news",
  "/session?topicId=PRIVACY_F01",
  "/session?topicId=GRCENG_CAP",
];

function slugify(value) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/(^-|-$)/g, "").toLowerCase();
}

async function collectPageSignals(page) {
  const signals = await page.evaluate(() => {
    const bodyText = document.body?.innerText || "";
    const paragraphs = Array.from(document.querySelectorAll("p")).map((el) =>
      (el.textContent || "").trim()
    );
    const veryLongParagraphs = paragraphs.filter((p) => p.length > 600).length;
    const doubleSpaces = (bodyText.match(/ {2,}/g) || []).length;
    const images = Array.from(document.images).map((img) => ({
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      clientWidth: img.clientWidth,
      clientHeight: img.clientHeight,
    }));
    const brokenImages = images.filter((img) => img.naturalWidth === 0 || img.naturalHeight === 0);
    const tinyImages = images.filter((img) => img.clientWidth > 0 && (img.clientWidth < 24 || img.clientHeight < 24));
    const expandControls = Array.from(
      document.querySelectorAll("button, a, [role='button']")
    ).filter((el) => /expand|enlarge|zoom|fullscreen|full screen/i.test(el.textContent || ""));
    return {
      bodyText,
      veryLongParagraphs,
      doubleSpaces,
      imageCount: images.length,
      brokenImages,
      tinyImagesCount: tinyImages.length,
      expandControlsCount: expandControls.length,
    };
  });
  const typos = TYPO_PATTERNS.filter((p) => p.test(signals.bodyText)).map((p) => String(p));
  return { ...signals, typos };
}

async function tryToggleTheme(page) {
  const toggle = page.locator(
    "button[aria-label*='theme' i], button[title*='theme' i], button:has-text('Light'), button:has-text('Dark')"
  );
  if ((await toggle.count()) > 0) {
    await toggle.first().click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}

async function trySessionFlow(page) {
  const steps = [];
  for (let i = 0; i < 40; i++) {
    const runCheck = page.getByRole("button", { name: /run check/i });
    if (await runCheck.isVisible().catch(() => false)) {
      await runCheck.click().catch(() => {});
      steps.push("run-check");
    }

    const option = page.locator("button").filter({ hasText: /^[A-D]$/ }).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click().catch(() => {});
      steps.push("pick-option");
      await page.waitForTimeout(150);
    }

    const nextLike = page.getByRole("button", {
      name: /next|continue|see results|complete session|complete capstone/i,
    }).first();
    if (await nextLike.isVisible().catch(() => false)) {
      const label = (await nextLike.textContent().catch(() => "next")) || "next";
      await nextLike.click().catch(() => {});
      steps.push(`click-${label.trim().toLowerCase()}`);
      await page.waitForTimeout(250);
      continue;
    }

    break;
  }
  return steps;
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
  const page = await context.newPage();

  const report = { pages: [], summary: { failures: 0 } };
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  for (const route of PAGES) {
    const url = `${BASE_URL}${route}`;
    const entry = { route, url, ok: true, issues: [], sessionSteps: [] };
    try {
      const res = await page.goto(url, { waitUntil: "networkidle", timeout: 20000 });
      if (!res || res.status() >= 400) {
        entry.ok = false;
        entry.issues.push(`HTTP status ${res?.status() ?? "unknown"}`);
      }
      await page.waitForTimeout(600);

      const lightShot = path.join(OUT_DIR, `${slugify(route || "root")}-light.png`);
      await page.screenshot({ path: lightShot, fullPage: true });

      const toggled = await tryToggleTheme(page);
      if (toggled) {
        const darkShot = path.join(OUT_DIR, `${slugify(route || "root")}-dark.png`);
        await page.screenshot({ path: darkShot, fullPage: true });
      }

      if (route.startsWith("/session")) {
        entry.sessionSteps = await trySessionFlow(page);
        await page.screenshot({
          path: path.join(OUT_DIR, `${slugify(route)}-post-flow.png`),
          fullPage: true,
        });
      }

      const signals = await collectPageSignals(page);
      entry.signals = signals;
      if (signals.veryLongParagraphs > 0) {
        entry.issues.push(`Very long paragraphs: ${signals.veryLongParagraphs}`);
      }
      if (signals.doubleSpaces > 0) {
        entry.issues.push(`Double spaces in body text: ${signals.doubleSpaces}`);
      }
      if (signals.typos.length > 0) {
        entry.issues.push(`Potential typos matched patterns: ${signals.typos.join(", ")}`);
      }
      if (signals.brokenImages.length > 0) {
        entry.issues.push(`Broken images: ${signals.brokenImages.length}`);
      }
      if (signals.tinyImagesCount > 0) {
        entry.issues.push(`Potentially unreadable tiny images: ${signals.tinyImagesCount}`);
      }
      if (signals.expandControlsCount === 0) {
        entry.issues.push("No explicit expand/enlarge controls detected.");
      }
    } catch (error) {
      entry.ok = false;
      entry.issues.push(`Navigation/test error: ${error.message}`);
    }

    report.pages.push(entry);
    if (!entry.ok || entry.issues.length > 0) report.summary.failures += 1;
  }

  if (consoleErrors.length > 0) {
    report.consoleErrors = Array.from(new Set(consoleErrors)).slice(0, 50);
  }

  await writeFile(
    path.join(OUT_DIR, "playwright-qa-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf-8"
  );

  await browser.close();
  console.log(`QA report written to ${path.join(OUT_DIR, "playwright-qa-report.json")}`);
  console.log(`Pages with issues: ${report.summary.failures}/${report.pages.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
