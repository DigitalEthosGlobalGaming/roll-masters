import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const stress = args.includes("--stress");
const verify = args.includes("--verify");
const env = { ...process.env };
if (verify) {
  env.PERF_VERIFY = "1";
  env.PERF_REPORT_ROOT ??= "reports/performance/verification";
}
if (stress) {
  if (verify) throw new Error("Choose either --stress or --verify");
  env.PERF_STRESS = "1";
  env.PERF_REPORT_ROOT ??= env.PERF_PROFILE ? "reports/performance/stress-profile" : "reports/performance/stress";
}
async function run(commandArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, commandArgs, { cwd: root, env, stdio: "inherit" });
    const interrupt = () => child.kill("SIGINT");
    process.once("SIGINT", interrupt);
    child.once("error", reject);
    child.once("exit", (code, signal) => { process.removeListener("SIGINT", interrupt); resolve(signal ? 1 : code ?? 1); });
  });
}
const build = await run(["node_modules/vite/bin/vite.js", "build", "--mode", "performance", "--sourcemap", "--outDir", "reports/performance/build"]);
process.exitCode = build || await run(["node_modules/@playwright/test/cli.js", "test", "--config", "playwright.performance.config.ts", ...args.filter(arg => arg !== "--verify" && arg !== "--stress")]);
