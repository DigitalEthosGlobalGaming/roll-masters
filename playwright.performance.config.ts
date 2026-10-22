import { defineConfig } from "@playwright/test";

const reportRoot = process.env.PERF_REPORT_ROOT ?? (process.env.PERF_STRESS
  ? process.env.PERF_PROFILE ? "reports/performance/stress-profile" : "reports/performance/stress"
  : process.env.PERF_PROFILE ? "reports/performance/profile" : "reports/performance");

export default defineConfig({
  testDir: "./tests/performance",
  testMatch: process.env.PERF_VERIFY ? "**/gameplay.spec.ts" : "**/game.perf.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  outputDir: `${reportRoot}/artifacts`,
  reporter: [
    ["list"],
    ["html", { outputFolder: `${reportRoot}/html`, open: "never" }],
    ["json", { outputFile: `${reportRoot}/results.json` }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4175",
    actionTimeout: 10_000,
    hasTouch: !!process.env.PERF_VERIFY,
    browserName: "chromium",
    headless: !process.env.PERF_HEADED,
    launchOptions: {
      // Headless shell otherwise selects SwiftShader on this Windows host.
      args: process.platform === "win32" && process.env.PERF_GPU !== "0" ? ["--use-angle=d3d11"] : [],
    },
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --outDir reports/performance/build --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: false,
  },
});
