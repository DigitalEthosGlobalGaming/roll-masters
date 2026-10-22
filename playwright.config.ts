import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  // Keep engine/WebGL startup from competing with another cold browser process.
  // Unit files and CI jobs still execute in parallel; raise this after measuring the host.
  workers: Number(process.env.BROWSER_TEST_WORKERS ?? 1),
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 20_000,
  expect: { timeout: 8_000 },
  outputDir: "reports/browser/artifacts",
  reporter: [
    ["list"],
    ["html", { outputFolder: "reports/browser/html", open: "never" }],
    ["junit", { outputFile: "reports/browser/junit.xml" }]
  ],
  use: {
    baseURL: "http://127.0.0.1:4174",
    browserName: "chromium",
    headless: true,
    viewport: { width: 1280, height: 720 },
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off"
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174 --strictPort",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000
  }
});
