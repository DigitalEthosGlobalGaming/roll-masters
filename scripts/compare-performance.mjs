import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const [baseline = "reports/performance/baseline/results.json", current = "reports/performance/results.json"] = process.argv.slice(2);
function readRuns(path) {
  const report = JSON.parse(readFileSync(path, "utf8"));
  const runs = new Map();
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests) for (const result of test.results) {
      const attachment = result.attachments?.find(item => item.name === "performance.json");
      if (!attachment || result.status !== "passed") continue;
      const run = attachment.path ? JSON.parse(readFileSync(attachment.path, "utf8")) : JSON.parse(Buffer.from(attachment.body, "base64").toString());
      if (run.profiling) continue;
      const list = runs.get(run.scenario.name) ?? [];
      list.push(run); runs.set(run.scenario.name, list);
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  walk(report);
  if (!runs.size) throw new Error(`No passing timing runs found in ${path}`);
  if (report.stats?.unexpected || report.stats?.interrupted) throw new Error(`Report contains failures or interrupted tests: ${path}`);
  return runs;
}
function median(runs, key) {
  const values = runs.map(run => run[key]).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
}
const before = readRuns(baseline), after = readRuns(current);
const comparisons = [];
for (const [name, previous] of before) {
  const next = after.get(name);
  if (!next) throw new Error(`Missing scenario: ${name}`);
  const signature = run => JSON.stringify([run.scenario.pieces, run.scenario.graphics, run.scenario.width, run.scenario.height, run.browser, run.metadata.renderer, run.metadata.dpr, run.headed]);
  if (new Set([...previous, ...next].map(signature)).size !== 1) throw new Error(`Incompatible browser/renderer/scenario settings for ${name}`);
  const metrics = ["averageFps", "frameP95Ms", "frameP99Ms", "updateP95Ms", "drawP95Ms", "framesOver33MsPercent", "peakActors"];
  const from = Object.fromEntries(metrics.map(key => [key, median(previous, key)]));
  const to = Object.fromEntries(metrics.map(key => [key, median(next, key)]));
  comparisons.push({ name, baselineRuns: previous.length, currentRuns: next.length, before: from, after: to, p95ImprovementPercent: (1 - to.frameP95Ms / from.frameP95Ms) * 100 });
}
const number = value => value.toFixed(1);
const lines = ["# Gameplay performance comparison", "", "Medians of passing runs; CPU profiling runs excluded. Timing varies with host load and power/thermal state.", "", `Baseline: \`${resolve(baseline)}\``, `Current: \`${resolve(current)}\``, "", "| Scenario | Runs before/after | FPS before → after | p95 ms before → after | p99 ms before → after | p95 reduction | Actors before → after |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"];
for (const row of comparisons) lines.push(`| ${row.name} | ${row.baselineRuns}/${row.currentRuns} | ${number(row.before.averageFps)} → ${number(row.after.averageFps)} | ${number(row.before.frameP95Ms)} → ${number(row.after.frameP95Ms)} | ${number(row.before.frameP99Ms)} → ${number(row.after.frameP99Ms)} | ${number(row.p95ImprovementPercent)}% | ${row.before.peakActors} → ${row.after.peakActors} |`);
for (const [label, runs] of [["Baseline", before], ["Current", after]]) for (const [name, group] of runs) {
  const stalled = group.filter(run => run.simulatedMs < run.samples.reduce((sum, sample) => sum + sample.interval, 0) * 0.9);
  if (stalled.length) lines.push("", `${label} warning: ${name} has ${stalled.length} run(s) with under 90% simulation-time advancement. Inspect raw stalls and p99; a lower p95 alone is insufficient evidence of improvement.`);
}
mkdirSync("reports/performance", { recursive: true });
writeFileSync("reports/performance/comparison.json", JSON.stringify(comparisons, null, 2));
writeFileSync("reports/performance/comparison.md", lines.join("\n") + "\n");
console.log(lines.join("\n"));
