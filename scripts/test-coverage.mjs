import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
async function run(args) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: "inherit" });
    child.once("error", error => { console.error(error); resolve(1); });
    child.once("exit", code => resolve(code ?? 1));
    process.once("SIGINT", () => child.kill("SIGINT"));
    process.once("SIGTERM", () => child.kill("SIGTERM"));
  });
}
const result = await run(["node_modules/c8/bin/c8.js", process.execPath, "scripts/test-unit.mjs", ...process.argv.slice(2)]);
process.exitCode = result || await run(["scripts/check-coverage.mjs"]);
