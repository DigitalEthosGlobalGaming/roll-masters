# Automated testing and reports

## Main-game performance benchmarks

Run `npm run test:browser:install` once, then `npm run test:perf`. This builds a
production bundle in `reports/performance/build` and runs real Excalibur gameplay
in isolated Chromium contexts on port 4175. It does not use your normal browser
profile or saved progress. The benchmark entry point is enabled only in the
special `performance` build mode; normal development and release builds use the
usual startup. The six comparison cases bypass save loading/autosave. An opt-in
extended case measures real autosave separately. Audio is not initialized during
timing runs.

Six cases cover an empty board, 64 pieces, a full 16×16 board, basic graphics,
portrait and landscape. Occupied boards contain 75% dice and 25% pawns, using a
fixed layout and seeded random stream. Dice are triggered every 1.1 seconds to
stress animation, scoring effects, HUD updates and pawn automation. These are
synthetic stress cases, not a replay of a particular player's save. Narrow
viewports run on the host CPU/GPU; they do not simulate phone hardware or touch.
Pawns retain the original staggered layout for comparisons. Adjacent pawns are
covered separately by gameplay regression checks and a long cyclic-chain unit
test; propagation uses a bounded, iterative traversal.

Each case warms up for five seconds and records twenty seconds. Reports include
average FPS, median/p95/p99 frame intervals, p95 engine update/draw CPU time,
frames over 33.34/50 ms, peak actors and earned energy. Scoring must occur on
occupied boards, and console/runtime errors fail the test. `performance.json`
attachments retain the raw frame samples. Use `npm run test:perf:report` to view
the HTML report; `reports/performance/results.json` also contains results and
attachment paths. Reports are ignored by Git and overwritten by the next run.
Reports also contain collision pairs, broadphase time, draw calls/image counts,
actor categories, and UI refresh/layout/paint counts during the measurement.

### Larger boards and mixed automation

Run `npm run test:perf:stress` for six additional cases, without replacing the
six comparison results above. Reports go to `reports/performance/stress/`.

| Case | Board and workload | Recording |
| --- | --- | --- |
| `stress-32-full` | 32×32, 768 dice and 256 pawns, advanced graphics | 20 seconds |
| `stress-32-full-basic` | Same full board, basic graphics | 20 seconds |
| `stress-16-mixed` | 16×16, 112 dice and 16 each of pawns, knights, bishops and rooks | 20 seconds |
| `stress-32-mixed` | 32×32, 448 dice and 64 each of pawns, knights, bishops and rooks | 20 seconds |
| `stress-32-mixed-portrait` | Same mixed board in a 390×844 viewport | 20 seconds |
| `stress-32-mixed-soak` | Same mixed board, desktop viewport, real 30-second autosave | 60 seconds |

Mixed boards leave five of each sixteen cells empty so moving buildings have
room to work. They require successful knight and rook moves and bishop ticks
during the measurement, in addition to earned energy and error-free execution.
The report records actual initial composition and measured activity counts.
All dice still receive the synthetic 1.1-second roll trigger; this is a demanding
fixture with real automation, not an unmodified player session. The camera fits
the entire board, so this does not test zoomed-in panning.

Reports also include the longest frame, frames over 100/200 ms, wall-clock versus
simulated time, Chromium main-thread task CPU time and JS heap usage before and
after measurement. Heap changes include allocations and garbage collection;
they are not retained-memory measurements or proof of a leak. GPU/native memory
is not included. No forced garbage collection or heap snapshots run during timing.
The soak test must include an actual autosave; it is a short soak, not a long-term
stability guarantee. No timing budget is imposed unless explicitly configured.

For a repeated targeted stress run:

```powershell
npm run test:perf:stress -- --grep "stress-32-mixed$" --repeat-each=3
```

Use `--grep "soak$"` to run only the longer case. `PERF_PROFILE=1` also works
with this command and writes to `reports/performance/stress-profile/` by default.
Open the stress report with
`npx playwright show-report reports/performance/stress/html`.

Initial expanded run (22 October 2026, one run per case, Windows Intel Graphics,
Chromium 156 with D3D11):

| Case | Average FPS | p95 frame interval |
| --- | ---: | ---: |
| 32×32 full, advanced | 34.3 | 38.2 ms |
| 32×32 full, basic | 35.7 | 36.3 ms |
| 16×16 mixed | 60.0 | 18.1 ms |
| 32×32 mixed, desktop | 58.3 | 20.6 ms |
| 32×32 mixed, portrait | 55.3 | 25.1 ms |
| 32×32 mixed, 60-second autosave soak | 58.3 | 21.1 ms |

All six passed their activity/error checks. No frames exceeded 100 ms, and game
simulation advanced within 0.1% of wall time. The soak performed two saves in
6.4 and 5.7 ms. These single-run observations identify the fully occupied board
as a useful next profiling workload; they are not regression budgets. The full
advanced case had p95 update/draw times of 24.0/14.8 ms. Repeat the cases before
attributing small differences to a code change.

### Engine processing optimization pass

The next pass disabled collision processing in `GameScene` (motion and action
systems remain active), removed built-in pointer components from buildings, the
grid and panels, and converted `GridSpace` from an actor into an entity with only
a transform. Cells retain their children, `GridSpace` serialized name, index
payload and placement coordinates. The cached board still draws the grid.
Benchmark inventory counts include cell entities independently of actor counts.

Repeated full 32×32 advanced runs on the same Windows Chromium/D3D11 host gave:

| Cumulative change | Runs | Median FPS | Median frame p95 | Median update p95 |
| --- | ---: | ---: | ---: | ---: |
| Fresh baseline | 2 | 37.7 | 35.2 ms | 21.6 ms |
| Collision processing disabled | 2 | 41.6 | 33.2 ms | 18.8 ms |
| Built-in pointers removed | 2 | 43.0 | 30.9 ms | 14.7 ms |
| Lightweight cells | 2 | 59.0 | 21.3 ms | 6.6 ms |

These are sequential observations, with no CPU profiling during timing. Host
load and power/thermal state affect the measurements; the two targeted final runs
ranged from 58.0 to 60.0 FPS. A later unchanged-build full-suite run measured
34.1 FPS on the full advanced board and 31.2 FPS on basic graphics while other
CPU-intensive work was taking place. A process CPU sample confirmed substantial
competing activity, so the 59.0 FPS median above is not a stable performance
guarantee. Retain the slower results in `reports/performance/engine-stress` and
repeat timings under comparable idle conditions before claiming a precise gain.
Detailed phase reports live in
`reports/performance/engine-baseline`, `engine-no-collisions`,
`engine-no-pointers` and `engine-lightweight-cells`; the local summary is
`reports/performance/engine-comparison.md`. The earlier comparison and stress
reports remain available separately. A batched piece renderer is deferred after
this improvement; piece animation and feedback still use the existing actors.

Real-engine gameplay checks additionally assert disabled collision processing,
absent building pointer components, non-actor cells, and removal of a placed die
when the board shrinks. Real Excalibur Node tests check cell/child transforms,
reparenting and the unchanged serialized cell identity.

For repeated runs or a focused case, build once and call Playwright directly:

```powershell
npm run test:perf:build
npx playwright test --config playwright.performance.config.ts --grep "desktop-full$" --repeat-each=3
```

`npm run test:perf -- --repeat-each=3` builds once and repeats all six cases.
On Windows, use `npm.cmd` if the PowerShell npm wrapper consumes CLI options.
To retain an earlier baseline and generate a median comparison:

```powershell
$env:PERF_REPORT_ROOT = "reports/performance/baseline"
npm.cmd run test:perf -- --repeat-each=3
Remove-Item Env:PERF_REPORT_ROOT
# Implement changes, then run the matching scenarios again.
npm.cmd run test:perf -- --repeat-each=3
npm.cmd run test:perf:compare
```

The comparison writes `reports/performance/comparison.md` and `.json`. It rejects
failed/interrupted reports and mismatched browser, renderer, viewport or graphics
settings. It excludes profiles and compares medians; keep the raw runs to assess
noise. Optional arguments to `test:perf:compare` select two different result files.

Extended diagnostics isolate effects, modal overhead and save stalls:

```powershell
$env:PERF_EXTENDED = "1"
npm.cmd run test:perf -- --grep "gold-hidden|menu-open|autosave"
Remove-Item Env:PERF_EXTENDED
```

The autosave case measures 35 seconds to include a normal 30-second save and
reports the synchronous serialization/storage duration. Extended cases have no
pre-optimization baseline. `npm run test:perf:verify` separately checks real
canvas touch placement/rolling, lazy modal reopening, resize screenshots, and
adjacent-pawn automation through save/reload at desktop/portrait/landscape sizes.
Its reports live under `reports/performance/verification`; these are desktop
Chromium contexts with touch enabled, not measurements on physical phones.

To capture a CPU profile of the full board:

```powershell
$env:PERF_PROFILE = "1"
npx playwright test --config playwright.performance.config.ts --grep "desktop-full$"
Remove-Item Env:PERF_PROFILE
```

Download the `game.cpuprofile` attachment from the HTML report and open it in a
CPU profile viewer such as Chrome DevTools. Profiling adds overhead, so compare
timing runs with profiling disabled. Engine draw time measures CPU submission,
not completed GPU work. Frame intervals include scheduling and presentation
delays; a slow interval alone does not identify the bottleneck.
Profile reports are stored separately in `reports/performance/profile/`; open
them with `npx playwright show-report reports/performance/profile/html`.

Establish a baseline with at least three runs on the same machine, power mode,
browser version, viewport and graphics settings, with other workloads closed.
Compare p95/p99 and slow-frame counts alongside FPS: an average can hide stutter.
For context, 60 FPS allows about 16.67 ms per frame and 30 FPS about 33.33 ms.
Headless rendering can differ from interactive play; set `PERF_HEADED=1` for a
headed comparison. Neither mode establishes performance on a physical phone.
On Windows the suite requests ANGLE Direct3D11 hardware rendering by default;
set `PERF_GPU=0` to compare Chromium's default software rendering. The actual
renderer is recorded in every report. Other platforms use Chromium's default.
If frames exceed 200 ms, Excalibur's clock substitutes 1 ms of simulation time;
check `simulatedMs` alongside wall time. A no-scoring failure can therefore mean
the renderer is too slow to exercise the workload, rather than broken dice.
CPU profiles and raw frame JSON are also saved directly in each test's artifact
folder. The benchmark build includes source maps for investigating bundled code.

Timing gates are opt-in: set `PERF_MAX_P95_MS` to a positive millisecond budget
derived from your baseline. Exceeding it fails a timing run; profiling runs skip
the gate. There is deliberately no universal FPS gate on shared CI hardware.
Performance tests are separate from smoke/unit suites and existing CI jobs;
run them explicitly, one worker at a time, without concurrent coverage/builds.

### Optimization measurements — 2026-10-22

Three baseline and three optimized runs per comparison case passed on Windows
with Chromium 156 and Intel Direct3D11 rendering. Median full-board FPS improved
from 42.3 to 59.9; p95 frame time fell from 41.2 to 20.2 ms, and p99 from 56.1 to
22.4 ms. Median p95 update/draw CPU times fell from 18.3/22.4 to 7.6/8.2 ms
(these independent percentiles should not be added). Reported peak actors fell
from 999 to 59 on the empty board, and 1542 to 1114 on the full board. Occupied
scenes still rolled and awarded energy. All six optimized cases had median FPS
near 60. These measurements supersede the earlier single-run observations.

Separate extended cases passed at approximately 60 FPS with flying gold hidden,
59 FPS with the build menu open, and 60 FPS with autosave; the measured save
took 8.5 ms. These are single diagnostic runs. A final CPU-profile run of the
completed build also passed near 60 FPS with p95 20.2 ms. Earlier diagnostic
runs encountered intermittent long scheduling gaps; retain p99/slow-frame and
simulation-time reporting rather than relying on average FPS or p95 alone.
Results are host-dependent and do not establish physical-phone performance.
The complete local before/after tables and raw data are in the ignored reports
directory; regenerate them with the comparison command above.

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
