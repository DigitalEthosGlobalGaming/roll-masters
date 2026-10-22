import { availableParallelism } from "node:os";
import { mkdirSync, readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const uiOnly = process.argv.includes("--ui");
const workers = Number(process.env.UNIT_TEST_WORKERS ?? Math.min(2, availableParallelism()));
if (!Number.isInteger(workers) || workers < 1) throw new Error("UNIT_TEST_WORKERS must be a positive integer");
const reports = uiOnly ? "reports/ui" : "reports/unit";
mkdirSync(new URL(`../${reports}/`, import.meta.url), { recursive: true });
const files = readdirSync(new URL("../tests/", import.meta.url))
  .filter(name => name.endsWith(".test.mjs") && (!uiOnly || name === "ui.test.mjs"))
  .sort().map(name => `tests/${name}`);
if (!files.length) throw new Error("No unit tests discovered");
console.log(`Running ${files.length} isolated test files with up to ${workers} workers`);
const child = spawn(process.execPath, [
  "--import", "./tests/ui-loader.mjs", "--test", `--test-concurrency=${workers}`,
  "--test-reporter=spec", "--test-reporter-destination=stdout",
  "--test-reporter=junit", `--test-reporter-destination=${reports}/junit.xml`,
  ...process.argv.slice(2).filter(arg => arg !== "--ui"), ...files
], { cwd: root, stdio: "inherit" });
child.on("error", error => { console.error(error); process.exitCode = 1; });
child.on("exit", (code, signal) => { process.exitCode = signal ? 1 : code ?? 1; });
process.once("SIGINT", () => child.kill("SIGINT"));
process.once("SIGTERM", () => child.kill("SIGTERM"));
