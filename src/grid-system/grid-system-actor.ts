import * as ex from "excalibur";
import { Grid } from "../graphics/grid";
import { GridSpace } from "./grid-space";
import { GridSystem } from "./grid-system";
import {
  ExtendedPointerEvent,
  InputHandler,
  InputManager,
} from "../input-manager";
import { Player } from "../player-systems/player";
import { GameScene } from "../scenes/game.scene";
import { Resources } from "../resources";

class GridSpaceGhost extends ex.Actor {
  spaceSize: ex.Vector = new ex.Vector(32, 32);
  constructor(size: ex.Vector) {
    super();
    this.spaceSize = size;
  }
  onInitialize(): void {
    this.graphics.add(
      "hide",
      new ex.Rectangle({
        width: 0,
        height: 0,
        color: ex.Color.Green,
      })
    );
    const sprite = ex.Sprite.from(Resources.ResizeDCrossDiagonal);
    sprite.destSize = {
      width: this.spaceSize.x * 1.2,
      height: this.spaceSize.y * 1.2,
    };
    sprite.opacity = 0.5;
    this.graphics.add("hover", sprite);
    this.graphics.use("hide");
  }

  show() {
    this.graphics.use("hover");
  }
  hide() {
    this.graphics.use("hide");
  }
}

export class DiceGameGridSystem extends GridSystem implements InputHandler {
  spaceSize: ex.Vector = new ex.Vector(32, 32);
  private _highlightedSpace: GridSpace | null = null;
  showGhost = false;

  get highlightedSpace(): GridSpace | null {
    return this._highlightedSpace;
  }

  set highlightedSpace(space: GridSpace | null) {
    if (this._highlightedSpace != space) {
      this._highlightedSpace = space;
      if (!this.showGhost) {
        this.ghost.hide();
        return;
      }
      if (space != null) {
        this.ghost.show();
        this.ghost.pos = space.pos;
      } else {
        this.ghost.hide();
      }
    }
  }
  ghost!: GridSpaceGhost;

  get level(): GameScene {
    if (this.scene instanceof GameScene) {
      return this.scene;
    }

    throw new Error("Scene is not a Level");
  }
  get player(): Player {
    if (this.level.player == null) {
      throw new Error("Player is null");
    }
    return this.level.player;
  }

  constructor(size: ex.Vector, spaceSize: ex.Vector) {
    super(size, spaceSize);
  }

  onPointerLeave(_evt: ExtendedPointerEvent): void {
    this.highlightedSpace = null;
  }

  onPointerUp(evt: ExtendedPointerEvent): void {
    let space = this.getSpaceFromWorldPosition(evt.worldPos);
    if (space != null) {
      this.player.onSpaceClicked(space);
    }
  }

  onPointerMove?(evt: ExtendedPointerEvent): void {
    let space = this.getSpaceFromWorldPosition(evt.worldPos);
    if (evt.pointerType == "Mouse") {
      this.showGhost = true;
    } else {
      this.showGhost = false;
    }
    this.highlightedSpace = space;
  }

  collides(vec: ex.Vector): boolean {
    let bounds = this.getBounds();
    return bounds.contains(vec);
  }

  onAdd(): void {
    InputManager.register(this);
  }

  onInitialize(): void {
    this.ghost = new GridSpaceGhost(this.spaceSize);
    this.addChild(this.ghost);
    this.ghost.hide();
    this.graphics.use(
      new Grid({
        rows: this.size.x,
        columns: this.size.y,
        cellWidth: this.spaceSize.x,
        cellHeight: this.spaceSize.y,
        color: ex.Color.Black,
        thickness: 1,
      })
    );

    for (let i = 0; i < this.size.x; i++) {
      for (let j = 0; j < this.size.y; j++) {
        this.getSpace(new ex.Vector(i, j));
      }
    }
  }

  getSpaceBounds(position: ex.Vector) {
    const x = position.x * this.spaceSize.x;
    const y = position.y * this.spaceSize.y;
    return new ex.BoundingBox(
      this.pos.x + x,
      this.pos.y + y,
      this.pos.x + x + this.spaceSize.x,
      this.pos.y + y + this.spaceSize.y
    );
  }
}
