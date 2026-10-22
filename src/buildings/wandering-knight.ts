import { Building } from "@src/building";
import { Dice } from "@src/buildings/dice";
import { GridSpace } from "@src/grid-system/grid-space";
import { Resources } from "@src/resources";
import { random } from "@src/utility/random";
import { ChessPiece } from "./chess-piece";


export class WanderingKnight extends ChessPiece {
  static serializeName: string = "WanderingKnight";
  tickRate: number = random.integer(450, 550);

  constructor() {
    super("knight");
    this.spriteImage = Resources.ChessKnight;
  }

  onTick(_delta: number): void {
    super.onTick(_delta);
    this.move();
  }

  getFreeNeighbor() {
    const neighbors = this.getNeighbors();
    let freeNeighbors = [];
    for (let neighborIndex in neighbors) {
      const neighbor = neighbors[neighborIndex as keyof typeof neighbors];
      if (neighbor == null) {
        continue;
      }
      let children = neighbor.children;
      let hasBuilding = children.some((child) => child instanceof Building);
      if (!hasBuilding) {
        freeNeighbors.push(neighbor);
      }
    }
    return freeNeighbors;
  }
  get neighboringBuildings() {
    const results: Building[] = [];
    const neighbors = Object.values(this.getNeighbors());
    for (let neighbor of neighbors) {
      const children = neighbor?.children ?? [];
      for (let child of children) {
        if (child instanceof Building) {
          results.push(child);
        }
      }
    }
    return results;
  }

  get neighboringDice() {
    const neighbors = this.neighboringBuildings.filter(
      (item) => item instanceof Dice
    );
    return neighbors as Dice[];
  }

  moveTo(space: GridSpace) {
    super.moveTo(space);
    const diceToBonus = this.neighboringDice;
    for (let dice of diceToBonus) {
      const parent = dice.parent;
      let value = (this.player.getUpgrade("WanderingKnight")?.value ?? 1) / 10;
      value = Math.floor(value * 10) / 10;
      this.whenMovementPasses(1, () => {
        if (dice.parent === parent && dice.scene === this.scene && !dice.isKilled() && !dice.rolling) {
          dice.multiplier += value;
        }
      });
    }
    this.tickRate = random.integer(450, 550);
  }

  move() {
    let freeNeighbors = this.getFreeNeighbor();
    if (freeNeighbors.length == 0) {
      return;
    }
    const freeSpace = random.fromArray(freeNeighbors);
    if (freeSpace) {
      this.moveTo(freeSpace);
    }
  }
}
