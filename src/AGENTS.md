# Source — Agent Instructions

## Scope and validation

Do not use a browser for changes or verification unless the user explicitly
requests browser use. Follow the root `AGENTS.md` restriction, including for
headless and automated browser checks.

These instructions supplement the root `AGENTS.md` for all files under `src/`.
Run commands from the repository root: `npm run lint` for Oxlint,
`npx tsc --noEmit` for type checking and
`npm run build` for the full production build. `npm run test:ui` runs focused UI
unit tests under Node with engine/DOM doubles, without a browser. There is no
separate source package. Avoid browser tests and long end-to-end tests for local
development unless the user explicitly requests them, as described in the root
instructions. Report gameplay and mobile flows that remain unverified.

## Adding or changing features

- **Buildings:** extend `Building` in `building.ts`, implement behavior under
  `buildings/`, and follow its `onBuild`, `onTrigger`, and `onTick` hooks.
  Expose build actions in `player-systems/player-actions.ts`, add resources in
  `resources.ts`, and register persistent classes in `dice-save-system.ts`.
  Check unlock research and placement cost as well as actor behavior.
- **Upgrades:** extend `Upgrade` from `components/upgrade-component.ts`; place
  definitions under `upgrades/research/` or `upgrades/prestige/`. Register them in
  `components/player-upgrades-component.ts`. Keep upgrade registry keys, saved
  `code` values, unlock action keys, and callers consistent. Existing spellings
  such as `BetterPassiverEnergy` are identifiers to trace before renaming.
- **Scenes:** normally extend `Level` from `level.ts`, register in `main.ts`, and
  add navigation where needed. `scenes/router.ts` is currently empty; it is not
  the active scene registry. Follow activation/deactivation cleanup patterns.
- **UI:** reuse `ui/panel.ts` and `ui/elements/` widgets. Review the corresponding
  manual examples in `scenes/test/user-interface/` when changing shared controls.
  Follow `docs/ui-authoring.md`: build children/listeners in `onSetup`, derive
  state in `onRefresh`, arrange in `onLayout`, and update retained graphics in
  `onRender`. Never attach listeners or rebuild widget trees in paint hooks.
  Support mobile screen sizes, portrait/landscape layouts, and touch interaction;
  do not make essential actions depend on hover or keyboard input.
- **Input:** use `input/input-manager.ts` and its extended event types. Match
  registration with unregistration when entities are removed or killed, and
  preserve modal/scene input pause behavior.

## Lifecycle and state

Call superclass lifecycle methods where the base class supplies behavior. Keep
scene-dependent setup in the appropriate Excalibur lifecycle hook; save loading
constructs objects before attaching them. Clean up transient actors, listeners,
and timers when leaving scenes or destroying entities. Pay attention to static
state such as the shared `Roller` timer/queues when changing reload or prestige.

`scenes/game.scene.ts` owns load orchestration, 30-second autosave while active,
grid resizing, and prestige reset. `Player` stores energy, upgrade codes/levels,
and arbitrary player data; upgrades are restored in `postDeserialize`. Review the
complete save/load flow when modifying these objects, not just `serialize()`.

Do not rename persisted `serializeName` or upgrade `code` values for stylistic
consistency. The serializer uses explicit names because production minification
changes JavaScript class names. Preserve parent/child reconstruction and stable
IDs, including the player's `PLAYER` ID.

## Style example

Follow the existing imports, class names, and stable serialized identifiers:

```ts
import { Building } from "@src/building";

export class Roller extends Building {
  static serializeName: string = "Roller";
  friendlyName: string = "Pawn";
}
```

This excerpt is from `buildings/roller.ts`; retain its other behavior when editing.
Prefer `import type` for type-only dependencies where appropriate, as in
`building.ts`. Reuse Excalibur vectors, timers, and graphics conventions instead
of introducing another rendering or UI framework.
