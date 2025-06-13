import { Building } from "@src/building";
import { Resources } from "@src/resources";
import * as ex from "excalibur";
import { Engine, Timer } from "excalibur";
import { Dice } from "./dice";

import { random } from "@src/utility/random";


export class Roller extends Building {
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
        // let player: Player | null = null;
        for (let id in Roller.rollers) {
          let roller = Roller.rollers[id];
          if (roller.isKilled()) {
            delete Roller.rollers[id];
            continue;
          }
          if (roller.needsToRoll) {
            continue;
          }
          Roller.rollerQueue.push(roller);
          // player = roller.player;
          Roller.rollerQueue = random.array(Roller.rollerQueue);
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
    super();
    this.spriteImage = Resources.ChessPawn;
  }
  onAdd(engine: Engine): void {
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
  }

  onTrigger(): void {
    super.onBuild();
    this.rollDice();
  }
  rollDice() {
    this.needsToRoll = false;
    let neighbours = this.getNeighbors();
    for (let index in neighbours) {
      let neighbour = neighbours[index as keyof typeof neighbours];
      let children = neighbour?.children ?? [];
      for (let child of children) {
        if (child instanceof Dice) {
          child.rollDice();
        }
      }
    }
  }
}
