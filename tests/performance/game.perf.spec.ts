import { test, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import type { BenchmarkSample } from "../../src/performance/game-benchmark";

const scenarios: { name: string; pieces: number; graphics: string; width: number; height: number; query?: string; duration?: number }[] = process.env.PERF_STRESS ? [
  { name: "stress-32-full", pieces: 1024, graphics: "advanced", width: 1280, height: 720, query: "&size=32" },
  { name: "stress-32-full-basic", pieces: 1024, graphics: "basic", width: 1280, height: 720, query: "&size=32" },
  { name: "stress-16-mixed", pieces: 256, graphics: "advanced", width: 1280, height: 720, query: "&layout=mixed" },
  { name: "stress-32-mixed", pieces: 1024, graphics: "advanced", width: 1280, height: 720, query: "&size=32&layout=mixed" },
  { name: "stress-32-mixed-portrait", pieces: 1024, graphics: "advanced", width: 390, height: 844, query: "&size=32&layout=mixed" },
  { name: "stress-32-mixed-soak", pieces: 1024, graphics: "advanced", width: 1280, height: 720, query: "&size=32&layout=mixed&autosave", duration: 60_000 },
] : [
  { name: "desktop-empty", pieces: 0, graphics: "advanced", width: 1280, height: 720 },
  { name: "desktop-64", pieces: 64, graphics: "advanced", width: 1280, height: 720 },
  { name: "desktop-full", pieces: 256, graphics: "advanced", width: 1280, height: 720 },
  { name: "desktop-full-basic", pieces: 256, graphics: "basic", width: 1280, height: 720 },
  { name: "portrait-full", pieces: 256, graphics: "advanced", width: 390, height: 844 },
  { name: "landscape-full", pieces: 256, graphics: "advanced", width: 844, height: 390 },
];
if (process.env.PERF_EXTENDED && !process.env.PERF_STRESS) scenarios.push(
  { name: "desktop-full-gold-hidden", pieces: 256, graphics: "advanced", width: 1280, height: 720, query: "&hide-gold" },
  { name: "desktop-full-menu-open", pieces: 256, graphics: "advanced", width: 1280, height: 720, query: "&menu" },
  { name: "desktop-full-autosave", pieces: 256, graphics: "advanced", width: 1280, height: 720, query: "&autosave", duration: 35_000 },
);

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

for (const scenario of scenarios) {
  test(scenario.name, async ({ page, browser }, info) => {
    test.setTimeout((scenario.duration ?? 20_000) + 60_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    await page.setViewportSize({ width: scenario.width, height: scenario.height });
    await page.goto(`/?pieces=${scenario.pieces}&graphics=${scenario.graphics}${scenario.query ?? ""}`);
    await page.waitForFunction(() => !!window.gameBenchmark, { }, { timeout: 30_000 });
    // Warm assets/JIT/animations before recording. No tracing or screenshots during measurement.
    await page.waitForTimeout(5_000);
    const metricsSession = await page.context().newCDPSession(page);
    await metricsSession.send("Performance.enable");
    const readMetrics = async () => Object.fromEntries((await metricsSession.send("Performance.getMetrics")).metrics.map(metric => [metric.name, metric.value]));
    const initialMetrics = await readMetrics();
    const profiler = process.env.PERF_PROFILE ? await page.context().newCDPSession(page) : undefined;
    if (profiler) {
      await profiler.send("Profiler.enable");
      await profiler.send("Profiler.start");
    }
    const result = await page.evaluate(duration => window.gameBenchmark!.sample(duration), scenario.duration ?? 20_000);
    const finalMetrics = await readMetrics();
    await metricsSession.detach();
    if (profiler) {
      const { profile } = await profiler.send("Profiler.stop");
      const profilePath = info.outputPath("game.cpuprofile");
      await writeFile(profilePath, JSON.stringify(profile));
      await info.attach("game.cpuprofile", { path: profilePath, contentType: "application/json" });
      await profiler.detach();
    }
    const samples: BenchmarkSample[] = result.samples.slice(1);
    expect(samples.length, "the engine must produce frame samples").toBeGreaterThan(0);
    const intervals = samples.map(frame => frame.interval);
    const report = {
      scenario,
      date: new Date().toISOString(),
      browser: browser.version(),
      platform: process.platform,
      headed: !!process.env.PERF_HEADED,
      profiling: !!process.env.PERF_PROFILE,
      repeat: info.repeatEachIndex,
      metadata: await page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const debug = gl?.getExtension("WEBGL_debug_renderer_info");
        const renderer = gl && debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "unavailable";
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        return { userAgent: navigator.userAgent, dpr: devicePixelRatio, cores: navigator.hardwareConcurrency, renderer };
      }),
      frames: samples.length,
      averageFps: 1000 / (intervals.reduce((sum, value) => sum + value, 0) / samples.length),
      frameP50Ms: percentile(intervals, 0.5),
      frameP95Ms: percentile(intervals, 0.95),
      frameP99Ms: percentile(intervals, 0.99),
      updateP95Ms: percentile(samples.map(frame => frame.update), 0.95),
      drawP95Ms: percentile(samples.map(frame => frame.draw), 0.95),
      framesOver33MsPercent: intervals.filter(value => value > 33.34).length / samples.length * 100,
      maxFrameMs: Math.max(...intervals),
      framesOver100Ms: intervals.filter(value => value > 100).length,
      framesOver200Ms: intervals.filter(value => value > 200).length,
      measuredMs: intervals.reduce((sum, value) => sum + value, 0),
      simulationRatio: samples.reduce((sum, frame) => sum + frame.simulated, 0) / intervals.reduce((sum, value) => sum + value, 0),
      memory: {
        jsHeapStartBytes: initialMetrics.JSHeapUsedSize,
        jsHeapEndBytes: finalMetrics.JSHeapUsedSize,
        jsHeapChangeBytes: finalMetrics.JSHeapUsedSize - initialMetrics.JSHeapUsedSize,
      },
      browserTaskCpuMs: (finalMetrics.TaskDuration - initialMetrics.TaskDuration) * 1000,
      activity: result.activity,
      framesOver50Ms: intervals.filter(value => value > 50).length,
      peakActors: Math.max(...samples.map(frame => frame.actors)),
      peakCollisionPairs: Math.max(...samples.map(frame => frame.collisionPairs)),
      broadphaseP95Ms: percentile(samples.map(frame => frame.broadphase), 0.95),
      drawCallsP95: percentile(samples.map(frame => frame.drawCalls), 0.95),
      drawnImagesP95: percentile(samples.map(frame => frame.drawnImages), 0.95),
      energyGained: result.energyGained,
      saveDurations: result.saveDurations,
      simulatedMs: samples.reduce((sum, frame) => sum + frame.simulated, 0),
      diagnostics: result.diagnostics,
    };
    const reportPath = info.outputPath("performance.json");
    await writeFile(reportPath, JSON.stringify({ ...report, samples }, null, 2));
    await info.attach("performance.json", { path: reportPath, contentType: "application/json" });
    console.log(JSON.stringify(report, null, 2));
    expect(errors.length, errors.slice(0, 3).join("\n")).toBe(0);
    if (scenario.pieces > 0) expect(result.energyGained, "fixture must actually roll and score").toBeGreaterThan(0);
    if (scenario.query?.includes("autosave")) expect(result.saveDurations.length, "measurement must include an actual save").toBeGreaterThan(0);
    if (scenario.query?.includes("layout=mixed")) {
      for (const key of ["knightMoves", "rookMoves", "bishopTicks"]) {
        expect(result.activity[key], `mixed fixture must exercise ${key}`).toBeGreaterThan(0);
      }
    }
    // Collect baselines before opting into a machine-specific regression gate.
    if (process.env.PERF_MAX_P95_MS && !profiler) {
      const budget = Number(process.env.PERF_MAX_P95_MS);
      expect(Number.isFinite(budget) && budget > 0, "PERF_MAX_P95_MS must be positive").toBe(true);
      expect(report.frameP95Ms).toBeLessThanOrEqual(budget);
    }
  });
}
