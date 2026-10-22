import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const lines = ["## Automated tests", "", "| Suite | Tests | Failures/errors | Skipped |", "| --- | ---: | ---: | ---: |"];
for (const [name, file] of [["Node", "reports/unit/junit.xml"], ["Headless Chromium", "reports/browser/junit.xml"]]) {
  if (!existsSync(file)) continue;
  const xml = readFileSync(file, "utf8");
  lines.push(`| ${name} | ${(xml.match(/<testcase\b/g) ?? []).length} | ${(xml.match(/<(?:failure|error)\b/g) ?? []).length} | ${(xml.match(/<skipped\b/g) ?? []).length} |`);
}
if (existsSync("reports/run-status.json")) {
  const statuses = JSON.parse(readFileSync("reports/run-status.json", "utf8"));
  lines.push("", ...statuses.map(status => `- ${status.name}: ${status.exitCode === 0 ? "passed" : `failed (exit ${status.exitCode})`}`));
}
if (existsSync("reports/coverage/coverage-summary.json")) {
  const coverage = JSON.parse(readFileSync("reports/coverage/coverage-summary.json", "utf8")).total;
  lines.push("", `Whole-application unit coverage: **${coverage.lines.pct}% lines**, **${coverage.branches.pct}% branches**, **${coverage.functions.pct}% functions**.`,
    "", "These unit tests use engine/DOM doubles. Browser smoke results are separate; their coverage is not merged into these percentages.");
}
const markdown = `${lines.join("\n")}\n`;
mkdirSync("reports", { recursive: true });
writeFileSync("reports/summary.md", markdown);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
