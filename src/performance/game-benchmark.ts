import * as ex from "excalibur";
import { Dice } from "@src/buildings/dice";
import { benchmarkLayout } from "./benchmark-layout";
import { WanderingKnight } from "@src/buildings/wandering-knight";
import { Bishop } from "@src/buildings/bishop";
import { Rook } from "@src/buildings/rook";
import { Roller } from "@src/buildings/roller";
import { Environment, Settings } from "@src/env";
import { GameScene } from "@src/scenes/game.scene";
import { GridSpace } from "@src/grid-system/grid-space";
import { Building } from "@src/building";
import { Panel } from "@src/ui/panel";
import { FloatingScore } from "@src/ui/scores/floating-score";
import { DiceSaveSystem } from "@src/dice-save-system";

export interface BenchmarkSample {
  interval: number;
  update: number;
  draw: number;
  simulated: number;
  actors: number;
  collisionPairs: number;
  broadphase: number;
  drawCalls: number;
  drawnImages: number;
}

declare global {
  interface Window {
    gameBenchmark?: {
      dice: number;
      pawns: number;
      inspect: () => { dice: number; pawns: number; playerId?: number; score: number; gridSize: number; enabledBuildingColliders: number; queuedPawns: number; pawnTimer: boolean; collisionProcessing: boolean; buildingPointers: number; gridCellActors: number };
      cellCenter: (x: number, y: number) => { x: number; y: number };
      controlCenter: (name: string) => { x: number; y: number } | null;
      addPawnChain: () => void;
      resize: (size: number) => void;
      reloadSave: () => void;
      sample: (durationMs: number) => Promise<{ samples: BenchmarkSample[]; energyGained: number; activity: Record<string, number>; diagnostics: unknown; saveDurations: number[] }>;
    };
  }
}

// Imported only by the dedicated production-mode benchmark build.
export async function startBenchmark(game: ex.Engine): Promise<void> {
  const params = new URLSearchParams(location.search);
  const count = Number(params.get("pieces") ?? 256);
  const size = Number(params.get("size") ?? 16);
  const mixed = params.get("layout") === "mixed";
  const layout = benchmarkLayout(size, count, mixed);
  Environment.set("graphics", params.get("graphics") === "basic" ? Settings.graphics.basic : Settings.graphics.advanced);
  Environment.set("reduced-motion", false);
  Environment.set("hide-floating-gold", params.has("hide-gold"));
  // Fixed random stream and board layout; wall-clock scheduling can still vary.
  let seed = 12345;
  Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const scene = game.director.getSceneInstance("GameScene");
  if (!(scene instanceof GameScene)) throw new Error("GameScene is not registered");
  // Use the normal new-player setup, bypassing save loading and autosave.
  scene.previouslyLoaded = true;
  await game.goToScene("GameScene");
  const deadline = performance.now() + 10_000;
  while (!scene.gridSystem || !scene.player) {
    if (performance.now() > deadline) throw new Error("Benchmark scene did not initialize");
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  const grid = scene.gridSystem;
  const player = scene.player;
  const dice: Dice[] = [];
  let pawns = 0;
  grid.size = ex.vec(size, size);
  const composition = { dice: 0, pawn: 0, knight: 0, bishop: 0, rook: 0 };
  const activity: Record<string, number> = { knightMoves: 0, rookMoves: 0, bishopTicks: 0 };
  for (const cell of layout) {
    const piece = cell.kind === "pawn" ? new Roller() : cell.kind === "knight" ? new WanderingKnight()
      : cell.kind === "bishop" ? new Bishop() : cell.kind === "rook" ? new Rook() : new Dice();
    // Observe real automation without changing its cadence or movement rules.
    if (piece instanceof WanderingKnight || piece instanceof Rook) {
      const move = piece.move.bind(piece);
      const key = piece instanceof Rook ? "rookMoves" : "knightMoves";
      piece.move = () => {
        const parent = piece.parent;
        move();
        if (piece.parent !== parent) activity[key]++;
      };
    } else if (piece instanceof Bishop) {
      const tick = piece.onTick.bind(piece);
      piece.onTick = delta => { activity.bishopTicks++; tick(delta); };
    }
    grid.getSpace(ex.vec(cell.x, cell.y))!.addChild(piece);
    composition[cell.kind]++;
    if (piece instanceof Dice) dice.push(piece);
    else if (piece instanceof Roller) pawns++;
  }
  player.wishPosition = grid.getBounds().center;
  scene.camera.zoom = Math.min(game.screen.resolution.width / (size * 32 + 128), game.screen.resolution.height / (size * 32 + 208));
  // Keep dice active, including scoring/feedback. Pawns retain their real timer.
  scene.addTimer(new ex.Timer({
    interval: 1100,
    repeats: true,
    fcn: () => { for (const die of dice) die.rollDice(); },
  })).start();
  if (params.has("menu")) player.playerUi.openMenu("build");
  const saves: { time: number; duration: number }[] = [];
  if (params.has("autosave")) {
    scene.saveSystem = new DiceSaveSystem();
    scene.saveSystem.addClassMapping(GameScene);
    scene.addTimer(new ex.Timer({ interval: 30_000, repeats: true, fcn: () => {
      const start = performance.now();
      scene.save();
      saves.push({ time: start, duration: performance.now() - start });
    } })).start();
  }
  window.gameBenchmark = {
    dice: dice.length,
    pawns,
    inspect: () => {
      const entities = scene.world.entities.filter(entity => !entity.isKilled());
      return { dice: entities.filter(entity => entity instanceof Dice).length, pawns: entities.filter(entity => entity instanceof Roller).length,
        playerId: scene.player?.id, score: scene.player?.score ?? 0, gridSize: scene.gridSystem?.size.x ?? 0,
        enabledBuildingColliders: entities.filter(entity => entity instanceof Building && entity.body.collisionType !== ex.CollisionType.PreventCollision).length,
        collisionProcessing: scene.physics.config.enabled,
        buildingPointers: entities.filter(entity => entity instanceof Building && entity.has(ex.PointerComponent)).length,
        gridCellActors: entities.filter(entity => entity instanceof GridSpace && entity instanceof ex.Actor).length,
        queuedPawns: Roller.rollerQueue.length, pawnTimer: Roller.globalTimer?.isRunning ?? false };
    },
    cellCenter: (x, y) => {
      const point = game.worldToScreenCoordinates(scene.gridSystem!.getSpaceBounds(ex.vec(x, y)).center);
      return { x: point.x, y: point.y };
    },
    controlCenter: name => {
      const panel = scene.world.entities.find((entity): entity is Panel => entity instanceof Panel && entity.rendered && entity.focusable && entity.accessibleName.startsWith(name));
      if (!panel) return null;
      const point = panel.globalBounds.center;
      return { x: point.x, y: point.y };
    },
    addPawnChain: () => {
      for (let x = 5; x < 8; x++) scene.gridSystem!.getSpace(ex.vec(x, 5))!.addChild(x === 7 ? new Dice() : new Roller());
    },
    resize: size => { scene.gridSystem!.size = ex.vec(size, size); },
    reloadSave: () => {
      scene.saveSystem = new DiceSaveSystem();
      scene.saveSystem.addClassMapping(GameScene);
      scene.save();
      scene.load();
    },
    sample: (durationMs) => new Promise(resolve => {
      const samples: BenchmarkSample[] = [];
      const start = performance.now();
      let previous = start;
      const energy = player.score;
      const initialActivity = { ...activity };
      const uiMetrics = () => scene.world.entities.filter((entity): entity is Panel => entity instanceof Panel)
        .reduce((sum, panel) => ({ refreshes: sum.refreshes + panel.metrics.refreshes, layouts: sum.layouts + panel.metrics.layouts, paints: sum.paints + panel.metrics.paints }), { refreshes: 0, layouts: 0, paints: 0 });
      const initialUi = uiMetrics();
      const collect = () => {
        const now = performance.now();
        const frame = game.stats.currFrame;
        samples.push({ interval: now - previous, update: frame.duration.update, draw: frame.duration.draw, simulated: frame.elapsedMs, actors: frame.actors.total,
          collisionPairs: frame.physics.pairs, broadphase: frame.physics.broadphase, drawCalls: frame.graphics.drawCalls, drawnImages: frame.graphics.drawnImages });
        previous = now;
        if (now - start >= durationMs) {
          game.off("postframe", collect);
          const actors = scene.world.entities.filter(entity => !entity.isKilled());
          const inventory = { gridCells: 0, buildings: 0, visibleUi: 0, hiddenUi: 0, floatingGold: 0, other: 0 };
          for (const actor of actors) {
            if (actor instanceof Panel) inventory[actor.rendered ? "visibleUi" : "hiddenUi"]++;
            else if (actor instanceof GridSpace) inventory.gridCells++;
            else if (actor instanceof Building) inventory.buildings++;
            else if (actor instanceof FloatingScore) inventory.floatingGold++;
            else if (actor instanceof ex.Actor) inventory.other++;
          }
          const finalUi = uiMetrics();
          resolve({ samples, activity: Object.fromEntries(Object.entries(activity).map(([key, value]) => [key, value - initialActivity[key]])), energyGained: player.score - energy, saveDurations: saves.filter(save => save.time >= start).map(save => save.duration), diagnostics: {
            inventory, composition, gridSize: size, occupiedCells: layout.length,
            uiWork: { refreshes: finalUi.refreshes - initialUi.refreshes, layouts: finalUi.layouts - initialUi.layouts, paints: finalUi.paints - initialUi.paints },
            dice: dice.length, pawns, score: player.score,
            firstDie: dice[0] && { rolling: dice[0].rolling, pos: dice[0].globalPos, graphic: dice[0].graphics.current?.constructor.name },
            camera: scene.camera.pos, zoom: scene.camera.zoom,
          } });
        }
      };
      game.on("postframe", collect);
    }),
  };
}
