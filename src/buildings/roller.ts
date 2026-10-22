import { ChessPiece } from "./chess-piece";
import { Resources } from "@src/resources";
import * as ex from "excalibur";
import type { Engine, Timer } from "excalibur";


export class Roller extends ChessPiece {
  static serializeName: string = "Roller";
  friendlyName: string = "Pawn";
  get tooltip(): string | null {
    return "Regularily rolls all dice in neighboring spaces.";
  }
  needsToRoll = false;
  static globalTimer: Timer | null = null;
  static lastGlobalTick = 0;
  static rollers: Record<number, Roller> = {};
  static rollerQueue: Roller[] = [];
  static rollsPerTick = 1;
  static rollRate = 10000;
  static rollRollers() {
    if (Roller.lastGlobalTick == 0) {
      Roller.lastGlobalTick = Date.now() + Roller.rollRate;
    }
    try {
      if (Roller.lastGlobalTick < Date.now()) {
        Roller.lastGlobalTick = Date.now() + Roller.rollRate;
        const queued = new Set(Roller.rollerQueue);
        for (let id in Roller.rollers) {
          let roller = Roller.rollers[id];
          if (roller.isKilled()) {
            delete Roller.rollers[id];
            continue;
          }
          if (queued.has(roller)) {
            continue;
          }
          Roller.rollerQueue.push(roller);
          roller.needsToRoll = true;
        }
        // Shuffle once, in linear time, after collecting this tick's work.
        for (let i = Roller.rollerQueue.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [Roller.rollerQueue[i], Roller.rollerQueue[j]] = [Roller.rollerQueue[j], Roller.rollerQueue[i]];
        }
      }

      for (let i = 0; i < Roller.rollsPerTick; i++) {
        if (Roller.rollerQueue.length > 0) {
          let roller = Roller.rollerQueue.shift();
          if (!roller?.isKilled()) {
            roller?.rollDice();
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  }
  constructor() {
    super("pawn");
    this.spriteImage = Resources.ChessPawn;
  }
  onAdd(engine: Engine): void {
    if (Roller.globalTimer && Roller.globalTimer.scene !== this.scene) Roller.resetAutomation();
    if (Roller.globalTimer == null) {
      Roller.globalTimer = new ex.Timer({
        fcn: () => {
          Roller.rollRollers();
        },
        interval: 100,
        repeats: true,
      });
      this.scene?.addTimer(Roller.globalTimer);
      Roller.globalTimer.start();
    }

    Roller.rollers[this.id] = this;

    super.onAdd(engine);
  }
  onRemove(engine: Engine): void {
    super.onRemove(engine);
    delete Roller.rollers[this.id];
    Roller.rollerQueue = Roller.rollerQueue.filter(roller => roller !== this);
    this.needsToRoll = false;
    if (Object.keys(Roller.rollers).length === 0) Roller.resetAutomation();
  }

  static resetAutomation(): void {
    const timer = Roller.globalTimer;
    timer?.stop();
    if (timer?.scene) timer.scene.removeTimer(timer);
    Roller.globalTimer = null;
    Roller.lastGlobalTick = 0;
    Roller.rollers = {};
    for (const roller of Roller.rollerQueue) roller.needsToRoll = false;
    Roller.rollerQueue = [];
  }

  onTrigger(): void {
    super.onBuild();
    this.rollDice();
    this.scene?.emit("tutorial-signal", "rolled:Pawn" as any);
  }
  rollDice() {
    // Preserve connected-pawn propagation without recursion or duplicate triggers.
    const pending: Roller[] = [this];
    const visited = new Set<ex.Entity>();
    for (let index = 0; index < pending.length; index++) {
      const roller = pending[index];
      if (visited.has(roller) || roller.isKilled()) continue;
      visited.add(roller);
      roller.playActivation();
      roller.needsToRoll = false;
      for (const neighbour of Object.values(roller.getNeighbors())) {
        for (const child of neighbour?.children ?? []) {
          if (child instanceof Roller) {
            if (!visited.has(child)) pending.push(child);
          } else if (!visited.has(child) && typeof (child as { rollDice?: unknown }).rollDice === "function") {
            visited.add(child);
            (child as ex.Entity & { rollDice(): void }).rollDice();
          }
        }
      }
    }
  }
}
