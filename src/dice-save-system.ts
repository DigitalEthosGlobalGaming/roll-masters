
import { Building } from "./building";
import { Bishop } from "@src/buildings/bishop";
import { WanderingKnight } from "@src/buildings/wandering-knight";
import { Scene } from "excalibur";
import { Dice } from "./buildings/dice";
import { Roller } from "./buildings/roller";
import { Rook } from "./buildings/rook";
import { GridSpace } from "./grid-system/grid-space";
import { DiceGameGridSystem } from "./grid-system/grid-system-actor";
import { Player } from "./player-systems/player";
import { SaveSystem } from "./systems/save-system";

// This needs to be done because the classes themselves get minimized and the names are changed
const classes = {
  Building,
  Player: Player,
  Dice: Dice,
  Roller: Roller,
  WanderingKnight: WanderingKnight,
  DiceGameGridSystem: DiceGameGridSystem,
  GridSpace: GridSpace,
  Bishop: Bishop,
  Rook: Rook,
};

export class DiceSaveSystem extends SaveSystem {
  constructor() {
    super(Object.values(classes));
  }

  save(obj: Scene): any {
    const data = super.save(obj);
    localStorage.setItem("save", JSON.stringify(data));
    return data;
  }

  load(scene: Scene): void {
    let data = localStorage.getItem("save");
    if (data == null) {
      return;
    }

    super.load(scene, data ?? "");
  }
}
