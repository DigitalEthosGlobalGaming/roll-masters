import * as ex from "excalibur";
import { GridSpace } from "./grid-system/grid-space";
import { Player } from "./player-systems/player";
import { DiceGameScene } from "./scenes/dice-game.scene";
import { Serializable } from "./systems/save-system";

console.log("T");
export class Building extends ex.Actor implements Serializable {
  static serializeName: string = "Building";
  friendlyName: string = "Building";
  tickRate = -1;
  lastTick = -1;
  _wishScale = 1;
  get wishScale() {
    return this._wishScale;
  }
  set wishScale(value: number) {
    this._wishScale = value;
  }
  wishPos = ex.vec(0, 0);
  speed = 0.1;

  get tooltip(): string | null {
    return null;
  }
  get gridSpace(): GridSpace {
    if (this.parent instanceof GridSpace) {
      return this.parent;
    }
    throw new Error("parent is not a grid space");
  }
  get gridPos(): ex.Vector {
    return this.gridSpace.gridPos ?? ex.vec(0, 0);
  }
  get level() {
    if (this.scene instanceof DiceGameScene) {
      return this.scene;
    }
    throw new Error("Scene is not a game scene");
  }
  private _color: ex.Color = ex.Color.White;

  get color(): ex.Color {
    return this._color;
  }

  set color(value: ex.Color) {
    this._color = value;
    let currentGraphics = this.graphics.current;
    if (currentGraphics instanceof ex.Sprite) {
      currentGraphics.tint = value;
    }
  }
  get now() {
    return new Date().getTime();
  }

  set nextTick(value: number) {
    this.lastTick = this.now + value;
  }

  _spriteImage?: ex.ImageSource;

  set spriteImage(value: ex.ImageSource | undefined) {
    if (value == undefined) {
      this._spriteImage = undefined;
      return;
    }
    const sprite = ex.Sprite.from(value);
    sprite.destSize = {
      width: 24,
      height: 24,
    };
    this.graphics.add("empty", sprite);
    this.graphics.use("empty");
  }

  get spriteImage() {
    return this._spriteImage;
  }

  get player(): Player {
    if (this.level.player == null) {
      throw new Error("Player is null");
    }
    return this.level.player;
  }

  constructor() {
    const width = 24;
    const height = 24;
    super({
      width: width,
      height: height,
    });
  }
  serialize(): any {
    return null;
  }
  deserialize(_data: any): void { }

  getNeighbors() {
    return this.gridSpace.getNeighbors();
  }

  resetTicker() {
    const now = new Date().getTime();
    this.lastTick = now;
  }

  updateScale() {
    const xDistance = Math.abs(this.scale.x - this.wishScale);
    const yDistance = Math.abs(this.scale.y - this.wishScale);
    if (xDistance < 0.1 && yDistance < 0.1) {
      this.scale = new ex.Vector(this.wishScale, this.wishScale);
    } else {
      this.scale = ex.lerpVector(
        this.scale,
        new ex.Vector(this.wishScale, this.wishScale),
        0.1
      );
    }
  }

  getSpace(pos: ex.Vector) {
    return this.level.gridSystem?.getSpace(pos);
  }

  getBuilding(pos: ex.Vector) {
    let space = this.level.gridSystem?.getSpace(pos);
    if (space == null) {
      return null;
    }
    return space.children.find((child) => child instanceof Building);
  }

  updatePosition() {
    const speed = this.speed;
    const xDistance = Math.abs(this.pos.x - this.wishPos.x);
    const yDistance = Math.abs(this.pos.y - this.wishPos.y);
    if (xDistance < speed && yDistance < speed) {
      this.pos = new ex.Vector(this.wishPos.x, this.wishPos.y);
    } else {
      this.pos = ex.lerpVector(
        this.pos,
        new ex.Vector(this.wishPos.x, this.wishPos.y),
        speed
      );
    }
  }

  onPreUpdate(_engine: ex.Engine, _elapsed: number): void {
    if (this.tickRate > 0) {
      const now = new Date().getTime();

      if (this.lastTick == -1) {
        this.lastTick = now;
      } else {
        if (now - this.lastTick >= this.tickRate) {
          this.lastTick = now;
          this.onTick(now);
        }
      }
    }

    this.updateScale();
    this.updatePosition();
  }

  moveTo(space: GridSpace | ex.Vector) {
    if (space instanceof ex.Vector) {
      let newSpace = this.getSpace(space);
      if (newSpace == null) {
        return;
      }
      space = newSpace;
    }
    this.wishScale = 1;
    let offset = this.globalPos.clone().sub(space.globalPos);
    this.gridSpace.removeChild(this);
    space.addChild(this);
    this.pos = offset;
  }

  onTick(_delta: number) { }

  build() {
    const speed = 0.75;
    const scale = 1.5;
    this.scale = ex.vec(scale, scale);

    // this.actions.scaleTo(ex.vec(scale, scale), ex.vec(speed, speed));
    this.actions.scaleTo(ex.vec(1, 1), ex.vec(speed, speed));
    this.onBuild();
  }
  onBuild() {

  }

  trigger() {
    this.onTrigger();
  }
  onTrigger() { }
}
