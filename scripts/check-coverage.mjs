import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const report = JSON.parse(readFileSync(path.join(root, "reports/coverage/coverage-summary.json"), "utf8"));
const gates = {
  "src/ui/panel.ts": { lines: 85, branches: 75, functions: 70 },
  "src/input/input-manager.ts": { lines: 85, branches: 75, functions: 70 },
  "src/ui/nine-slice-config.ts": { lines: 100, branches: 100, functions: 100 }
};
let failed = false;
for (const [file, thresholds] of Object.entries(gates)) {
  const measured = report[path.join(root, file)];
  if (!measured) { console.error(`Missing coverage: ${file}`); failed = true; continue; }
  for (const [metric, minimum] of Object.entries(thresholds)) {
    if (measured[metric].pct < minimum) {
      console.error(`${file}: ${metric} ${measured[metric].pct}% is below ${minimum}%`);
      failed = true;
    }
  }
}
if (!failed) console.log("Core UI/input coverage gates passed; whole-application coverage is reported separately.");
process.exitCode = failed ? 1 : 0;
