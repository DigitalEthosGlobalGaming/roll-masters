import { Building } from "@src/building";
import { motionPreferences } from "@src/settings/motion-preferences";
import { GridSpace } from "@src/grid-system/grid-space";
import * as ex from "excalibur";
import { PieceFeedback } from "./piece-feedback";
import type { PieceMotionStyle } from "./piece-feedback";

// Shared presentation for chess buildings; concrete classes retain their save names.
export class ChessPiece extends Building {
  private feedback: PieceFeedback;

  constructor(style: PieceMotionStyle) {
    super();
    this.feedback = new PieceFeedback(style);
  }

  private get quietMotion() {
    return motionPreferences.quiet;
  }

  onInitialize(engine: ex.Engine): void {
    super.onInitialize(engine);
    let transformed = false;
    this.graphics.onPreDraw = ctx => {
      const pose = this.feedback.pose(this.quietMotion);
      transformed = pose.rotation !== 0 || pose.scaleX !== 1 || pose.scaleY !== 1;
      if (!transformed) return;
      ctx.save();
      // Pivot at the foot of the piece so compression stays planted on the board.
      ctx.translate(0, 12);
      ctx.rotate(pose.rotation);
      ctx.scale(pose.scaleX, pose.scaleY);
      ctx.translate(0, -12);
    };
    this.graphics.onPostDraw = ctx => { if (transformed) ctx.restore(); };
  }

  onPreUpdate(engine: ex.Engine, elapsed: number): void {
    this.feedback.advance(elapsed);
    super.onPreUpdate(engine, elapsed);
    const pose = this.feedback.pose(this.quietMotion);
    // Graphics offsets participate in render bounds; long moves can cross the viewport.
    if (this.graphics.offset.x !== pose.x || this.graphics.offset.y !== pose.y) this.graphics.offset = ex.vec(pose.x, pose.y);
  }

  protected playActivation() {
    this.feedback.activate();
  }

  protected whenMovementPasses(progress: number, callback: () => void) {
    // Instant movement in quiet mode has instant contact effects as well.
    if (this.quietMotion) callback();
    else this.feedback.whenPassed(progress, callback);
  }

  moveTo(space: GridSpace | ex.Vector) {
    const target = space instanceof ex.Vector ? this.getSpace(space) : space;
    if (target == null || target === this.parent) return;
    const pose = this.feedback.pose(this.quietMotion);
    const origin = this.globalPos.add(ex.vec(pose.x, pose.y));
    super.moveTo(target);
    // Reserve the destination immediately; animate only its displayed offset.
    this.pos = this.wishPos.clone();
    const offset = origin.sub(this.globalPos);
    this.feedback.move(offset.x, offset.y);
    const start = this.feedback.pose(this.quietMotion);
    this.graphics.offset = ex.vec(start.x, start.y);
  }
}
