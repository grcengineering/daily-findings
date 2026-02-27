/** @type {import('playwright/test').PlaywrightTestConfig} */

const baseURL = process.env.BASE_URL ?? "http://127.0.0.1:3199";

const config = {
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15000,
    navigationTimeout: 20000,
  },
  timeout: 60000,
  expect: { timeout: 10000 },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
};

export default config;
