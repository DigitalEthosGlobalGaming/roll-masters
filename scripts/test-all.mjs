import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
mkdirSync(path.join(root, "reports"), { recursive: true });
// Only remove named report files belonging to this combined run, never source or saves.
for (const file of ["unit/junit.xml", "browser/junit.xml", "coverage/coverage-summary.json", "run-status.json"]) {
  rmSync(path.join(root, "reports", file), { force: true });
}
const jobs = [
  ["unit coverage", ["scripts/test-coverage.mjs"]],
  ["headless smoke", ["node_modules/@playwright/test/cli.js", "test"]]
];
const children = jobs.map(([name, args]) => new Promise(resolve => {
  const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
  child.once("error", error => { console.error(`${name}: ${error.message}`); resolve(1); });
  child.once("exit", (code, signal) => { console.log(`${name}: ${signal ?? code}`); resolve(code ?? 1); });
  process.once("SIGINT", () => child.kill("SIGINT"));
  process.once("SIGTERM", () => child.kill("SIGTERM"));
}));
// Let both finish so failures still produce reports from the other test layer.
const results = await Promise.all(children);
writeFileSync(path.join(root, "reports/run-status.json"), JSON.stringify(jobs.map(([name], index) => ({ name, exitCode: results[index] })), null, 2));
process.exitCode = results.some(code => code !== 0) ? 1 : 0;
await import("./report-tests.mjs");
