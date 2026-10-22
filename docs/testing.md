# Automated testing and reports

## Quick start

Use the Node version in `.nvmrc`. After `npm ci`, unit tests need no server or
browser. Headless tests require a one-time `npm run test:browser:install`, which
downloads only Chromium's headless shell and required browser tooling. Reinstall
when the locked Playwright version changes. Linux CI also installs system libraries.

| Command | Purpose |
| --- | --- |
| `npm test` | Discover top-level `tests/*.test.mjs` and run files in parallel, without coverage overhead. |
| `npm run test:ui` | Run just the UI unit regression file. |
| `npm run test:coverage` | Run all unit files, generate coverage, and enforce core coverage gates. |
| `npm run test:smoke` | Run the small headless Chromium suite; start Vite automatically. |
| `npm run test:all` | Run unit coverage and headless smoke concurrently; produce a combined summary. |
| `npm run test:typecheck` | Type-check the browser tests and Playwright configuration. |
| `npm run test:report` | Manually open the browser suite's HTML report. |
| `npm run test:summary` | Regenerate Markdown summary from the latest existing reports. |

The combined command waits for both layers, preserves failures as a nonzero exit
code, and lets the other layer finish producing diagnostics. Do not run multiple
copies of the same suite simultaneously: that suite's report directory is reused.
Separate invocations of `test:summary` summarize the latest saved reports; they do
not execute or validate tests.

## Parallelism and isolation

Node defaults to at most two isolated test-file processes. Tests within a file
remain sequential because the UI doubles share global document/engine state.
Add independent top-level `.test.mjs` files to scale parallelism; they are
discovered automatically. Do not enable same-file concurrency on shared fixtures.

Playwright defaults to one browser worker. During initial validation, two cold
WebGL engine launches timed out on this Windows host; one worker passed all three
smoke tests in 14.3 seconds including server startup. Unit file execution took
about one second in the parallel test run. The verified combined run passed 27
Node tests and three browser checks; its browser phase took 28.4 seconds while
coverage ran alongside it. These are observations, not runtime
guarantees; downloads and CI provisioning are excluded.

`test:all` still overlaps the two test layers. CI runs static checks, unit coverage,
and browser smoke as three independent jobs. Raising browser concurrency is an
opt-in tuning choice after measuring the machine:

```powershell
$env:UNIT_TEST_WORKERS = "4"
$env:BROWSER_TEST_WORKERS = "2"
npm run test:all
Remove-Item Env:UNIT_TEST_WORKERS, Env:BROWSER_TEST_WORKERS
```

Each browser test gets a fresh non-persistent context and localStorage. Browser
processes are reused within workers. The gallery route starts the actual engine
and assets without loading a saved game. Passing tests record neither video nor
trace; failures save screenshots, and the first CI retry records a trace. Local
retries are disabled so flaky tests remain visible. Vite is reused locally when
already listening on `127.0.0.1:4174`; CI starts a fresh server. A production build
is not required before each smoke run.

## What each layer verifies

Most Node UI tests load actual UI/input TypeScript through a source-mapped loader
and substitute small engine/DOM doubles. They cover lifecycle invariants, geometry,
input state, modal scope, upgrades, and atlas configuration.

`tests/graphics-rendering.test.mjs` uses real Excalibur graphics classes with a
synthetic drawing context to verify transforms, bounds, tint propagation, and
independent slice configuration. These tests do not verify browser pixels or
gameplay appearance.

The initial headless suite loads the real Excalibur UI gallery, checks startup
errors, exercises slider keyboard input, resizes between narrow portrait and
landscape viewports, and verifies initial state/storage isolation. It currently
interacts with semantic controls, so it does not establish canvas pointer hit
testing, touch delivery, or visual correctness. The narrow viewport case is a
resize check, not real mobile-device emulation. Gameplay spending, seeded dice,
save round trips, and prestige integration remain future browser fixtures; in
particular, development-mode economy bypasses must be separated before asserting
purchase rules against the dev server.

## Reports and coverage policy

| File | Contents |
| --- | --- |
| `reports/unit/junit.xml` | Unit results for CI/test integrations. |
| `reports/ui/junit.xml` | Focused UI-only run, separate from the complete unit run. |
| `reports/coverage/index.html` | Navigable coverage with source-line highlighting. |
| `reports/coverage/lcov.info` | Coverage input for editor integrations or a future coverage service. |
| `reports/coverage/coverage-summary.json` | Machine-readable totals and per-file percentages. |
| `reports/browser/html/index.html` | Headless results and failure attachments. |
| `reports/browser/junit.xml` | Browser test results for CI integrations. |
| `reports/browser/artifacts/` | Failure screenshots and retry traces. |
| `reports/summary.md` | Latest combined Markdown summary. |

All reports are ignored by Git. CI uploads each layer's reports as separate
artifacts, including on failure, retains them for seven days, and writes a summary
on the workflow job page. No paid reporting service, account, or token is needed.

c8 collects V8 coverage across the isolated Node processes and remaps it to the
original TypeScript. Reports include unexecuted `src/**/*.ts`; declaration files
and the manual gallery are excluded. Tests, doubles, dependencies, and generated
bundles are outside the coverage scope. Browser coverage is not collected or
merged into unit coverage, avoiding extra instrumentation on the fast smoke path.

Initial whole-application coverage is **19.62% lines**, **76.28% branches**, and
**65.04% functions**. Unexecuted files can contribute coarse function/branch counts,
so line coverage and individual files are more informative than those aggregate
branch/function percentages. Much of gameplay has no unit coverage yet.

The enforced gates in `scripts/check-coverage.mjs` are deliberately scoped:

| File | Lines | Branches | Functions |
| --- | ---: | ---: | ---: |
| `src/ui/panel.ts` | 85% | 75% | 70% |
| `src/input/input-manager.ts` | 85% | 75% | 70% |
| `src/ui/nine-slice-config.ts` | 100% | 100% | 100% |

Missing coverage for a gated file fails the check. Extend the policy as gameplay
tests arrive; do not lower thresholds or exclude application files to make the
number look better. A covered line is evidence of execution, not of meaningful
assertions or correct renderer behavior.

Routine agent work still defaults to non-browser checks under `AGENTS.md`.
Headless test execution requires the user's explicit authorization; configured CI
may run it automatically. Interactive browser inspection is not required to run
or read these reports.
