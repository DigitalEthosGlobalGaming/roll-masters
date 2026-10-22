# UI implementation review and improvement plan

Reviewed: 21 October 2026.

## Implementation update — 21 October 2026

The findings below describe the original implementation. Their code references
are historical; the replacement lifecycle is documented in [UI authoring](ui-authoring.md).

| Finding | Implementation |
| --- | --- |
| F1 | Sliders retain one track; backgrounds update only when geometry/style changes. |
| F2 | Cached child-bounds union preserves the local origin; measurement no longer calls back into ancestor measurement. |
| F3 | Per-pointer press/drag ownership, movement threshold, cancellation, and one activation hook are shared by controls and grid placement. |
| F4 | Empty text retains explicit visibility; bounded font fitting and wrapped text replace unbounded fitting. |
| F5 | Menus/gallery use one-time setup; actions reconcile named buttons; listeners/references no longer accumulate in paint. |
| F6 | Upgrade rows reconcile removals; prestige derives disabled state in both directions and keeps explicit confirmation state. |
| F7 | Separate refresh/layout/paint invalidation, cached measurement, consistent padding/gaps, and explicit viewport hooks replace recursive resize/render work. |
| F8 | Modal input scope, Close/Escape, focus restoration, keyboard controls, and semantic DOM companions are implemented; long content uses bounded pages. |
| F9 | Pointer/keyboard dispatch uses fresh wrappers and independent target caches. |
| F10 | Font loading settles on success/error/timeout, late font loads invalidate measurement, and the asset URL uses Vite's deployment-base handling. |

Performance/reuse safeguards include retained text graphics (instead of an extra
label actor per widget), stable named child registries, a shared menu root,
bounded paged content, and injected tooltip callbacks. Tooltip updates no longer
refresh the actions/upgrades trees. Idle tests assert that 1,000 unchanged renders
leave setup/refresh/layout/paint counters unchanged, including menu and prestige
layouts. Validation completed: 22 focused Node regression tests, Oxlint, TypeScript,
production bundling, and a build using `/roll-masters/` as the deployment base.
The generated stylesheet resolves the font under that base. The existing large
JavaScript chunk warning remains; actual frame/GPU profiling was not performed.

The user requested no browser use during implementation or validation; that rule
is recorded in the root and source `AGENTS.md` files. Browser checks were stopped
when requested. The retained automated suite runs under Node with engine/DOM
doubles. Actual canvas appearance, assistive-technology behavior, gameplay flows,
and device/GPU performance remain unverified. The earlier plan's browser and
profiling proposals require a separate explicit user request.

## Recommendation

Keep the Excalibur actor-based UI and improve it incrementally. The existing named child widgets, nine-slice backgrounds, and shared pointer dispatcher provide useful foundations. The main weakness is that rendering also creates widgets, installs listeners, changes layout, and synchronizes game state. These responsibilities need explicit boundaries before the system grows.

Start with correctness and input ownership, then introduce predictable layout and rendering. A replacement framework would expand the migration scope without first resolving the current interaction contract.

## Scope and evidence

This is a source review of `src/ui/`, `src/input/`, the player HUD/action/tooltip integrations, menu/settings scenes, UI demonstration scenes, and startup/font handling. References below are repository-relative paths with line numbers at review time.

Validation performed:

- `npm run build` passed, including TypeScript checking and Vite production bundling. The initial sandboxed attempt could not spawn esbuild; the subsequent approved build completed.
- Vite reported an unresolved `../fonts/DS-DIGI.TTF` reference and a JavaScript bundle above its 500 kB warning threshold (641.27 kB before gzip). The font warning merits a deployed-path check; bundle size alone does not establish a UI performance problem.
- There is no configured automated test runner. Files in `src/scenes/test/user-interface/` are interactive demonstrations, not assertion-based tests.
- No browser interaction, screenshots, accessibility audit, or runtime profiling was performed. Findings below describe code paths and expected consequences; runtime frequency and visual impact remain to be measured.

No application source changes are part of this review.

## Findings, ordered by priority

P1 means address before extending the shared UI. P2 means schedule in the next structural improvement pass. These priorities express implementation risk, not a claim that every affected path has been reproduced in a browser.

### F1 — P1: Slider graphics grow on every render

Evidence: `src/ui/elements/slider.ts:121–140`. `setGraphic()` checks `this.sliderGraphic` but never assigns it. `render()` calls `setGraphic()` even when the widget is clean, appending another track graphic each time the UI tree is traversed. Resizing also has no explicit retained-track update.

Fix: retain one track graphic, update or replace it only when its dimensions/style change, and keep graphic creation out of the unconditional render path.

Acceptance: after 1,000 unchanged render passes the slider has the same graphic count; resizing changes the existing track dimensions without growing that count.

### F2 — P1: Auto-size bounds exclude child extents

Evidence: `src/ui/panel.ts:393–430`. `calculateSize()` takes `Math.min` for both bottom-right coordinates. A union requires maximum bottom-right coordinates and minimum top-left coordinates. With separated children, the measured panel can exclude most of its content. Additionally, recursive child measurement can call parent measurement again while that parent is still measuring.

Fix: implement a pure child-bounds union, define how the measured origin relates to the centered panel origin, and replace synchronous upward/downward recursion with scheduled invalidation. Test negative offsets as well as children extending to the right/bottom. Correcting `Math.min` alone does not settle the origin or recursion contracts.

Acceptance: one child, separated siblings, nested panels, negative offsets, and child removal all produce finite, correct bounds without reentrant measurement.

### F3 — P1: Pointer release and dragging do not preserve ownership

Evidence: `src/input/input-manager.ts:272–417`. Release handlers go to targets under the release position; pressed targets are cleared on every move; drag targets are selected again at drag start and overwritten on release. Drag end occurs on a later move rather than directly on release. Hovered targets can receive pointer-move twice through the hover and dragging loops. Buttons activate on down (`src/ui/elements/button.ts:185`), while action buttons and settings override up handlers (`src/player-systems/player-actions-ui.ts:43`, `src/scenes/settings.scene.ts`).

Consequences: a press begun elsewhere can release onto an action button and select it; releasing outside the original control can miss its release handler; small pointer movement changes activation behavior. The unused `SliderButton` also calls `super.onPointerDown()` from its up handler (`slider.ts:13`).

Fix: track a press owner and drag owner per pointer, define a movement threshold, and deliver up/cancel/end to the original owner. Provide one activation event after a valid press/release sequence, plus an explicit opt-in for press-on-down controls. End dragging on release, cancel, blur, scene exit, and owner disposal. Migrate existing overrides to the shared activation API and retain intentional board-drag behavior.

Acceptance: press/release inside activates once; press outside/release inside does not activate; release outside cancels activation and ends dragging; movement within the threshold still permits a click; drag/move events are delivered once. Cover mouse buttons and touch cancellation.

### F4 — P1: Text can remain hidden or freeze font fitting

Evidence: `src/ui/elements/label.ts:47–58,111–123,167–170`. Empty text sets `visible = false`; later nonempty text never restores it. `adjustFontsizeToWidth()` increments the font indefinitely for empty text and positive target width because measured width stays zero; ordinary fitting also stops at the first size that reaches or exceeds the target.

Fix: separate explicit visibility from empty-content suppression. Guard empty text and invalid width, bound the search, and choose the largest fitting size.

Acceptance: `"Energy" → "" → "Energy"` renders correctly unless explicitly hidden; empty text fitting returns immediately; long strings fit within the target and configured font limits.

### F5 — P1: Render-time setup accumulates listeners and references

Evidence: `src/scenes/welcome.scene.ts:17–43` adds hover listeners inside `onRender()`. `src/scenes/test/user-interface/test-button.ts` does the same through repeated `setup()` calls. `src/player-systems/player-actions-ui.ts:137–166` appends existing named buttons to `buttons` each render. `addPanel()` reuses widgets but does not deduplicate these side effects.

Fix: construct the widget tree and attach listeners once per instance; synchronize properties separately. Reconcile action buttons by stable action code, removing obsolete items and replacing the array/map rather than appending reused references. Dispose owned subscriptions on removal.

Acceptance: repeated render, resize, action unlock, and scene navigation leave listener counts and action-button references bounded by the live widget count.

### F6 — P1: Research/prestige views can retain stale controls

Evidence: `src/ui/upgrades.ts:20–40` and `src/ui/prestige.ts:59–79` filter to `canResearch` before iterating. The inner removal branch for an ineligible upgrade is therefore unreachable, so existing rows absent from the new collection are not removed. `PrestigeUi` sets `disabled = true` for zero points but never explicitly restores false (`prestige.ts:34–36`).

Fix: reconcile all existing row keys against the desired set, including transitions to an empty list. Assign complete derived states on refresh, such as disabled, selected, and visible, in both directions. Preserve prestige confirmation in explicit state instead of treating button text as the state machine.

Acceptance: eligible → ineligible removes a row; no rows shows only the empty state; zero → positive points enables prestige; rerendering does not accidentally discard a pending confirmation.

### F7 — P2: Layout, resizing, and visibility have inconsistent contracts

Evidence: explicit `Panel.size` changes call `onResize()` but do not emit the `resize` event that `addPanel()` uses to remeasure parents (`panel.ts:253–269,499–505`). The screen resize callback only calls `calculateSize()`, which immediately returns for explicitly sized roots (`panel.ts:394,646`). Several roots set viewport-dependent sizes in `onRender()`, so this callback does not reliably refresh them. `screenSize` combines `screen.width` with `screen.drawHeight`, while other helpers use draw dimensions (`panel.ts:216–228`).

`Button` overrides width/height/size with its own padding and icon/text formulas (`button.ts:142–150`), including summing both content heights despite horizontal placement. `List.totalHeight` adds spacing after every child and includes hidden children (`list.ts:27–35`). `Slider.size` tests `_customSize != null`, which is always true for a boolean (`slider.ts:85–91`). Positional helpers also ignore part of their supplied vector, for example `topCenter` ignores x (`panel.ts:43–49`).

Fix: define content size, padding, desired size, arranged bounds, and hidden-versus-collapsed behavior once. Emit a consistent layout-change notification for explicit and measured changes. Have viewport changes schedule root arrangement using one coordinate convention. Replace individual button/list calculations with shared horizontal/vertical layout policies; clarify positional helper semantics.

Acceptance: nested content changes update ancestors in the same layout pass; visible children receive exactly `n - 1` gaps; padding applies once per edge; menus, HUD, and modals remain usable across small/large viewports and device pixel ratios.

### F8 — P2: Modal and keyboard dispatch lack an interaction scope

Evidence: `src/ui/modal.ts` supplies only a fixed 400×400 panel. Pointer hit testing returns all colliding entities at the first matching z layer (`src/input/extended-pointer-event.ts:30–65`); it does not establish a full-screen modal barrier. Keyboard dispatch broadcasts to registered entities without checking visibility, disabled state, or focus (`input-manager.ts:423–480`). `Panel.acceptingInputs` defaults true even for decorative content. `PlayerActionButton.collides()` bypasses the base visibility check (`player-actions-ui.ts:75`).

Fix: introduce explicit hit-test participation, deterministic target ordering, handled-event propagation, and a modal stack. Give the top modal exclusive pointer/keyboard scope, Escape-to-close, initial focus, and focus restoration. Add Tab navigation, Enter/Space activation, arrow-key slider changes, and visible focus. Decide how semantic browser controls or an accessible DOM companion should represent canvas controls through a small prototype; canvas keyboard support alone does not supply screen-reader semantics.

Acceptance: a modal blocks board/actions across its backdrop; hidden/disabled controls cannot activate by any input route; keyboard-only users can navigate settings and upgrade controls and return focus after closing.

### F9 — P2: Event adaptation mutates shared engine events

Evidence: `src/input/extended-pointer-event.ts:17–27` changes the incoming event's prototype and stores manager-specific cached targets on that same object. Multiple scene managers subscribe to the engine pointer source (`input-manager.ts:203–219`), and the extended-event check returns the existing wrapper unchanged. If active-scene ownership changes while the same event is dispatched, another manager could observe cached targets from the previous one. This cross-scene case needs a focused reproduction; prototype mutation is directly evident.

Fix: create a fresh typed event/context containing the original event, manager, pointer ID, positions, and resolved target path. Keep each dispatch's cached targets local. Apply the same ownership review to the extended keyboard event implementation.

Acceptance: adapting an event never changes its prototype; two managers adapting the same engine event have independent target sets; navigation initiated by input cannot dispatch to stale scene targets.

### F10 — P2: Startup can wait forever for the display font

Evidence: `src/main.ts:14–34` clears the polling interval at timeout without resolving or rejecting the promise. Engine creation depends on that promise settling. `src/style.css:1–6` references a font path that Vite warns it cannot resolve; the actual asset is `public/fonts/DS-DIGI.TTF`.

Fix: make font loading settle on success, failure, and timeout; start with a fallback font on failure and remeasure if the custom font becomes available later. Verify the asset URL in both root and subdirectory deployments using the existing build base conventions.

Acceptance: simulated font failure/timeout still reaches the game; the deployed font URL succeeds and text measurements update when the font changes.

## Target design

Keep `Panel` as the public facade during migration, but give each responsibility one owner:

| Responsibility | Proposed contract |
| --- | --- |
| Widget lifecycle | Create children/listeners once; dispose them through one owned subscription collection. Attachment and reattachment are explicit. |
| State synchronization | Presenters derive complete widget properties from player/settings state and emit commands through callbacks. Base widgets do not require a `Player` or a `Level`. |
| Measurement | Pure `measure(availableSize)` computes desired content size. No parent calls or graphics creation. |
| Arrangement | `arrange(bounds)` places children with stack/alignment/padding rules in a documented local coordinate space. |
| Invalidation | Distinguish layout changes from paint changes. A root queue coalesces changes and processes measurement, arrangement, then paint. |
| Rendering | Retain graphics; update changed properties. Repeating an unchanged render creates no widgets, subscriptions, or graphics. |
| Input | Scene-owned dispatcher resolves target paths, captures pointers, handles activation/cancellation, focus, and modal scope. |
| Styling | Shared typography, spacing, colors, focus/disabled/pressed/selected treatments, and nine-slice choices. |

Use content-size changes to invalidate ancestor measurement; propagate paint changes only where needed. Avoid recursively searching every subtree for dirtiness multiple times per frame. Measure frame cost before introducing spatial indexes, virtualization, or broad graphics caching.

Inject tooltip and sound services or callbacks into controls instead of looking up the player through the base panel. Make `Button.sound` effective (the current handler hardcodes `ChipLay2`). Give named-child APIs typed factories or typed widget maps so a name reused with a different class cannot silently return an invalid cast. Introduce these seams incrementally as callers migrate.

## Delivery plan

Each phase should be independently reviewable and preserve saved-game identifiers and storage formats. Effort labels are relative, not calendar estimates: S is localized, M spans shared controls and callers, L spans architecture and screen migration.

| Phase | Work | Effort | Exit criteria / dependencies |
| --- | --- | --- | --- |
| 1. Establish regression coverage and fix bounded defects | Add a small unit-test setup for geometry/control logic; fix F1, F2 bounds union, F4, F6, and font settlement in F10. Add assertions as each defect is fixed. | M | Regression cases above pass; production build passes. Keep deeper layout recursion work for phase 3. |
| 2. Make input ownership consistent | Implement F3 and F9, choose target ordering/propagation, centralize activation and disabled checks, migrate down/up overrides in menus, settings, action buttons, sliders, and prestige. | L | Mouse/touch press-drag-release matrix passes; board placement and camera drag remain correct. Depends on phase 1 baseline. |
| 3. Establish layout and lifecycle boundaries | Address F5/F7 with measure/arrange/invalidation; move construction/listeners out of render; standardize child removal/disposal; adopt shared stack layouts and viewport handling. | L | Stable counts after repeated renders; resize and nested sizing regressions pass. Migrate one menu and the slider demonstration first, then HUD, tooltips, research, and prestige. |
| 4. Add modal scope, keyboard use, and styles | Complete F8, prototype accessible semantics, introduce theme tokens and state visuals, wrap/clamp tooltips, constrain modal size, and support scrolling for long upgrade lists. | L | No modal click-through; keyboard-only menu/settings/upgrade flows work; small-screen content remains reachable. Depends on input and layout contracts. |
| 5. Harden and document | Add browser smoke checks and CI gates; publish widget authoring rules and update manual demonstrations; profile large/idle trees and optimize only measured bottlenecks. | M | All migrated screens use the same lifecycle/input/layout APIs; documented checks run consistently. |

## Verification and migration safeguards

Start with the smallest assertion-based tests that cover these failure modes. Keep real-engine browser coverage for transforms, scene lifecycle, and font metrics, where mocks would hide defects.

- Geometry/control checks: union bounds, padding, hidden/collapsed measurement, list spacing, text visibility/fitting, slider clamping/stepping, equal min/max, zero width, and invalid/nonpositive step. All public slider setters should produce finite, validated values.
- Input checks: inside/outside release, pointer jitter, drag termination, touch cancellation, right-button policy, disabled and hidden controls, overlapping targets, scene switching during dispatch, and modal keyboard/pointer isolation.
- Lifecycle checks: 1,000 unchanged renders leave graphic/listener/widget counts stable; 20 open/close/navigation cycles return counts to baseline. Review removal/re-addition as well as kill paths; remove disposed managers from static tracking.
- Integration checks: place and roll a die, drag the camera, update energy, unlock an action, buy research, transition eligibility, open/close upgrades, change settings, and complete prestige confirmation/reset in an isolated save profile.
- Display checks: representative 360×640, 768×1024, and 1920×1080 viewports; resize while a modal is open; device pixel ratios 1 and 2; camera pan/zoom; long tooltip text; missing/late fonts; production deployment under a URL subdirectory.
- Performance checks: record layout passes, paint rebuilds, retained graphics, registered input handlers, and UI frame time for idle and large synthetic trees. Set budgets from the baseline; do not treat the bundle-size warning as evidence of render cost.

Keep the existing UI demonstration scene as a development gallery, with a development-only navigation entry and deterministic scenarios. Add automated assertions alongside it. Introduce type checking, production build, and the new tests as CI gates; add browser checks after a stable isolated-save fixture exists.

Migrate one screen at a time behind compatibility adapters for current `addPanel`, size, and click APIs. Remove adapters only after callers and demonstrations have moved. Do not combine this work with save-schema changes, gameplay balancing, framework replacement, or dependency upgrades. The final migration should remove obsolete dirty flags, duplicate child lookup helpers, unused slider classes, and broad casts only after their replacements are verified.
