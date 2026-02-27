import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://127.0.0.1:3199";
const OUT_DIR = path.join(process.cwd(), "qa-artifacts");
const TYPO_PATTERNS = [
  /\bteh\b/i,
  /\brecieve\b/i,
  /\boccured\b/i,
  /\brequirments\b/i,
  /\bwronhg\b/i,
  /\bti does\b/i,
];

const SEVERE_CONSOLE_PATTERNS = [
  /uncaught\s+(exception|error)/i,
  /failed to fetch/i,
  /network\s+error/i,
  /syntax\s+error/i,
  /cannot read propert(y|ies) of (undefined|null)/i,
  /is not a function/i,
];

const PAGES = [
  "/",
  "/library",
  "/progress",
  "/history",
  "/news",
  "/session",
  "/session?topicId=PRIVACY_F01",
  "/session?topicId=GRCENG_CAP&overridePrereq=1",
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
    const ttsVoice = document.querySelector('[aria-label="Text-to-speech voice"]');
    const ttsSpeed = document.querySelector('[aria-label="Text-to-speech speed"]');
    const readAloud = Array.from(document.querySelectorAll("button")).find((b) =>
      /read aloud/i.test(b.textContent || "")
    );
    const ttsPresent = !!(ttsVoice || ttsSpeed || readAloud);
    const voiceOptions = ttsVoice ? ttsVoice.querySelectorAll("option").length : 0;
    return {
      bodyText,
      veryLongParagraphs,
      doubleSpaces,
      imageCount: images.length,
      brokenImages,
      tinyImagesCount: tinyImages.length,
      expandControlsCount: expandControls.length,
      ttsPresent,
      ttsVoiceOptions: voiceOptions,
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

async function tryEnlargeToggle(page) {
  const enlargeBtn = page.locator("button").filter({
    hasText: /enlarge|normal size/i,
  }).first();
  const visible = await enlargeBtn.isVisible().catch(() => false);
  if (!visible) {
    return { success: null, warning: "No enlarge control found (optional on this page)" };
  }
  try {
    const initialText = (await enlargeBtn.textContent()) || "";
    await enlargeBtn.click({ timeout: 3000 });
    await page.waitForTimeout(400);
    const afterFirstText = (await enlargeBtn.textContent()) || "";
    const toggled = initialText.toLowerCase().includes("enlarge")
      ? afterFirstText.toLowerCase().includes("normal")
      : afterFirstText.toLowerCase().includes("enlarge");
    if (toggled) {
      await enlargeBtn.click({ timeout: 3000 });
      await page.waitForTimeout(300);
    }
    return { success: !!toggled, warning: toggled ? null : "Enlarge toggle may not have changed state" };
  } catch (err) {
    return { success: false, warning: `Enlarge toggle error: ${err.message}` };
  }
}

async function trySessionFlow(page) {
  const steps = [];
  for (let i = 0; i < 40; i++) {
    const runCheck = page.getByRole("button", { name: /run check/i });
    if (await runCheck.isVisible().catch(() => false)) {
      await runCheck.click().catch(() => {});
      steps.push("run-check");
    }

    const option = page.getByRole("button", { name: /^[A-D]\b/i }).first();
    if (await option.isVisible().catch(() => false)) {
      await option.click().catch(() => {});
      steps.push("pick-option");
      await page.waitForTimeout(150);
    }

    const nextLike = page.getByRole("button", {
      name: /start session|next|continue|see results|complete session|complete capstone|back to dashboard/i,
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

function checkQuizScoreVisible(page) {
  return page.evaluate(() => {
    const body = document.body?.innerText || "";
    const hasQuizComplete = /quiz\s+complete/i.test(body);
    const hasScorePattern = /\d+\s*\/\s*\d+/.test(body) && /%?\s*correct/i.test(body);
    const hasTrophyOrResult = /trophy|score|result/i.test(body);
    return hasQuizComplete || (hasScorePattern && hasTrophyOrResult);
  });
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } });
  const page = await context.newPage();

  const report = { pages: [], summary: { failures: 0 }, severeConsoleErrors: [] };
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });

  for (const route of PAGES) {
    const url = `${BASE_URL}${route}`;
    const entry = {
      route,
      url,
      ok: true,
      issues: [],
      warnings: [],
      sessionSteps: [],
      quizInteraction: null,
      quizScoreVisible: null,
      enlargeToggle: null,
      ttsCheck: null,
    };
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
        const enlargeResult = await tryEnlargeToggle(page);
        entry.enlargeToggle = enlargeResult;
        if (enlargeResult.warning) {
          entry.warnings.push(enlargeResult.warning);
        }
        if (enlargeResult.success === false) {
          entry.issues.push("Enlarge control failed to toggle correctly");
        }

        entry.sessionSteps = await trySessionFlow(page);
        entry.quizInteraction = entry.sessionSteps.some(
          (s) => s === "pick-option" || s === "run-check"
        );
        entry.quizScoreVisible = await checkQuizScoreVisible(page).catch(() => false);
        if (entry.sessionSteps.length > 0 && !entry.quizScoreVisible && !entry.quizInteraction) {
          entry.warnings.push("Session flow ran but no quiz interaction or score detected");
        }
        if (entry.quizInteraction && !entry.quizScoreVisible) {
          entry.warnings.push("Quiz interaction occurred but score/result not visible");
        }

        await page.screenshot({
          path: path.join(OUT_DIR, `${slugify(route)}-post-flow.png`),
          fullPage: true,
        });
      }

      const signals = await collectPageSignals(page);
      entry.signals = signals;
      if (/application error: a client-side exception/i.test(signals.bodyText)) {
        entry.issues.push("Client-side application error rendered on page");
      }
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

      if (route.startsWith("/session") || route === "/news") {
        if (signals.ttsPresent) {
          entry.ttsCheck = {
            present: true,
            voiceOptions: signals.ttsVoiceOptions,
          };
          if (signals.ttsVoiceOptions === 0) {
            entry.warnings.push("TTS controls present but no voice options (may be headless/browser limitation)");
          }
        } else {
          entry.ttsCheck = { present: false };
          entry.warnings.push("TTS controls not found on text-heavy view (optional if content too short)");
        }
      }

      if (signals.expandControlsCount === 0 && route.startsWith("/session")) {
        entry.warnings.push("No explicit expand/enlarge controls detected on session page");
      } else if (signals.expandControlsCount === 0) {
        entry.warnings.push("No expand/enlarge controls on this page");
      }
    } catch (error) {
      entry.ok = false;
      entry.issues.push(`Navigation/test error: ${error.message}`);
    }

    report.pages.push(entry);
    if (!entry.ok || entry.issues.length > 0) report.summary.failures += 1;
  }

  const uniqueErrors = Array.from(new Set(consoleErrors)).slice(0, 50);
  if (uniqueErrors.length > 0) {
    report.consoleErrors = uniqueErrors;
    report.severeConsoleErrors = uniqueErrors.filter((text) =>
      SEVERE_CONSOLE_PATTERNS.some((p) => p.test(text))
    );
  }

  await writeFile(
    path.join(OUT_DIR, "playwright-qa-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf-8"
  );

  await browser.close();
  console.log(`QA report written to ${path.join(OUT_DIR, "playwright-qa-report.json")}`);
  console.log(`Pages with issues: ${report.summary.failures}/${report.pages.length}`);

  if (report.severeConsoleErrors && report.severeConsoleErrors.length > 0) {
    console.error("Severe console errors detected:");
    report.severeConsoleErrors.forEach((e) => console.error("  -", e));
    process.exit(1);
  }
  if (report.summary.failures > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
