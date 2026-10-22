# Roll Masters — Agent Instructions

## Project overview

Roll Masters is a client-side idle/incremental dice game. Players place dice on a
grid, click to generate energy, add chess-inspired automation buildings, buy
research, and prestige for persistent upgrades. It uses Excalibur 0.30.3,
TypeScript 7.0.2, Vite 8.3.4, and Oxlint 1.89.0. There is no backend in this
repository. The game must work on desktop and mobile browsers. Design features
for touch input, small screens, and portrait/landscape layouts; avoid relying
on hover or keyboard-only controls.

## Setup and commands

Run commands from the repository root. `.nvmrc` specifies Node.js 24.22.0.

- Install locked dependencies: `npm ci`.
- Start development server: `npm run dev` (`npm start` is equivalent).
- Check types without emitting files: `npx tsc --noEmit`.
- Lint source and build configuration: `npm run lint` (Oxlint).
- Apply safe lint fixes: `npm run lint:fix`.
- Run focused UI unit tests without a browser: `npm run test:ui`.
- Run all unit test files in parallel: `npm test`.
- Generate source-mapped HTML/LCOV coverage and enforce core gates: `npm run test:coverage`.
- Type-check browser tests/configuration: `npm run test:typecheck`.
- Explicit headless smoke run: `npm run test:smoke`; concurrent unit coverage and
  smoke run: `npm run test:all`. Install the headless browser once with
  `npm run test:browser:install`.
- Production build: `npm run build` (runs `tsc && vite build`, outputs `dist/`).
- Preview a completed build: `npm run serve`.

There are no configured format or clean scripts. Do not invent
commands for them. Keep `package-lock.json` in sync with dependency changes.

## Architecture and ownership

- `index.html` loads `src/style.css` and `src/main.ts`.
- `src/main.ts` loads the display font, creates the fullscreen Excalibur engine,
  registers scenes, and starts `GameScene`. Audio initializes on the first click.
- `src/level.ts` is the shared scene base, including input and debug drawing.
- `src/scenes/` contains gameplay, menus, settings, research/prestige screens,
  help, credits, and manual UI examples.
- `src/building.ts` and `src/buildings/` implement dice and automation actors.
- `src/grid-system/` owns cells, placement, neighbors, and grid interaction.
- `src/player-systems/` owns player state, camera/actions, action UI, and tooltips.
- `src/components/` owns score and upgrade logic; `src/upgrades/` contains
  research and prestige upgrade definitions.
- `src/ui/` is a custom Excalibur panel/widget system, rather than a DOM framework.
- `src/input/` provides shared pointer/keyboard dispatch and extended events.
- `src/systems/save-system.ts` serializes entity/component hierarchies;
  `src/dice-save-system.ts` registers game classes and stores saves locally.
- `src/resources.ts`, `src/game-loader.ts`, and `src/sound-manager.ts` handle assets.
- `public/` contains images, fonts, and sounds copied into the build.

Read `src/AGENTS.md` before changing source files.

For new game artwork or generated sprite imports, use the repository skill at
`.agents/skills/create-game-assets/SKILL.md`. Its text-only art brief replaces
visual inspection of existing images; delegate creation and import only new outputs.

## Validation

Do not open, control, or use a browser to implement or verify changes unless the
user explicitly asks for browser use. This includes browser automation and
headless browser tests. Use source review, focused non-browser tests, linting,
type checking, and production builds instead; report visual/gameplay checks
that remain unverified.

For local development changes, run `npm run lint` and `npm run build`. Prefer
these fast checks and focused code review. Avoid browser tests and long
end-to-end tests during routine local development unless the user explicitly
requests them. A successful build checks types and bundling but does not prove
gameplay or mobile usability works; report unverified behavior honestly.

`tests/ui.test.mjs` exercises UI lifecycle, layout, and input logic using small
engine/DOM doubles under Node; it does not verify canvas rendering or gameplay.
`npm test` also discovers other top-level `tests/*.test.mjs` files, including
nine-slice tests, in isolated processes. See `docs/testing.md` for worker limits,
reports, coverage gates, and the separate real-engine Chromium smoke suite.
The configured CI workflow runs headless smoke tests automatically; for local
agent work, retain the explicit browser-use requirement above.
`src/scenes/test/user-interface/` contains manual UI examples. Its gallery is
available through `?ui-gallery` in development builds only, outside the main menu. If the user requests
browser verification, report checks actually
performed and use an isolated browser profile/origin for tests that replace saved
progress. Consider mobile touch, layout, and orientation in any requested UI checks.

## Code conventions

Use strict TypeScript and the existing Excalibur actor/component/scene model.
Most source uses two-space indentation, double quotes, semicolons, PascalCase
classes, camelCase members, and kebab-case filenames; follow nearby code where
it differs. Both relative imports and `@src/...` imports are established.
The alias must stay aligned in `tsconfig.json` and `vite.config.ts`.
Preserve compiler checks for unused locals/parameters and implicit returns;
underscore intentionally unused lifecycle parameters. Avoid unrelated reformatting.

## Persistence and asset boundaries

- Gameplay is stored in localStorage under `save`; settings use `environment`.
  Do not clear or overwrite a user's progress as part of routine verification.
- Preserve serialized class names, upgrade codes, player data keys, and stored
  object structure. Add backward-compatible handling when changing persisted data.
- Serializable classes need stable `serializeName` values and registration in
  `DiceSaveSystem`; constructors used by the loader must work without arguments.
- Keep public asset paths compatible with deployment under a URL subdirectory.
  Follow the existing relative paths and resource registry when adding assets.
- Do not edit generated `dist/`, dependencies in `node_modules/`, or bundled
  third-party assets to implement application fixes. Never commit credentials;
  Vite client environment values are public build output.

## Delivery and documentation

`.github/workflows/build.yml` runs on pushes to `main` or manual dispatch. It
creates/pushes release tags, builds latest and timestamped versions, and deploys
to `gh-pages`. Local builds do not deploy. Preserve its `--base` handling and
`VITE_BUILD_VERSION` integration when changing build or resource configuration.
Do not push to `main` or trigger publishing merely to validate a change.

Keep changes focused and describe behavior changes and validation in the PR.
The existing contribution and PR templates in `.github/` originate from Excalibur;
verify references against this repository before assuming upstream tooling exists.
Use `codex/` for new agent-created branches unless instructed otherwise.
`README.md` is largely ideas/TODOs, so verify implementation in source rather
than treating every proposed feature as implemented. `src/game-updates.ts`
contains in-game update notes. There is no generated wiki in this repository.
