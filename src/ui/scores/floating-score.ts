import * as ex from "excalibur";
import { Resources } from "@src/resources";

export class FloatingScore extends ex.Actor {
  static numberOfInstances = 0;
  screenPos: ex.Vector = ex.Vector.Zero;
  value: number = 0;

  constructor(worldPos: ex.Vector, screenPos: ex.Vector) {
    super({
      pos: worldPos,
      width: 32,
      height: 32,
    });
    this.screenPos = screenPos;
  }

  async addScore(value: number) {
    this.value = value;
    if (this.value == 0) {
      this.kill();
      return new Promise<number>((resolve) => {
        resolve(0);
      });
    }
    const sprite = ex.Sprite.from(Resources.Dollar);
    sprite.destSize = { width: 10, height: 10 };
    this.graphics.use(sprite);

    return new Promise<number>((resolve) => {
      this.scale = ex.vec(2, 2);
      this.actions
        .moveTo({
          pos: ex.vec(this.screenPos.x, this.screenPos.y),
          duration: 500,
          easing: ex.EasingFunctions.EaseInQuad,
        })
        .callMethod(() => {
          resolve(this.value);
          this.kill();
        })
        .die();
    });
  }
}
