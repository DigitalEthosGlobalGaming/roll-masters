import * as ex from "excalibur";
import { InputManager } from "./input/input-manager";
import { Player } from "./player-systems/player";
import { ExtendedKeyEvent } from "./input/extended-key-event";

type DebugDrawElementsRect = {
  id?: string;
  type: "rect";
  bounds: ex.BoundingBox;
  color?: ex.Color;
  endTime?: number;
};

type DebugDrawElementCircle = {
  id?: string;
  type: "circle";
  pos: ex.Vector;
  radius: number;
  color?: ex.Color;
  endTime?: number;
};

type DebugDrawElementLine = {
  id?: string;
  type: "line";
  pos: ex.Vector;
  end: ex.Vector;
  color?: ex.Color;
  endTime?: number;
};

type DebugDrawElement =
  | DebugDrawElementsRect
  | DebugDrawElementCircle
  | DebugDrawElementLine;

export class Level extends ex.Scene {
  inputSystem!: InputManager;
  player?: Player;
  debugElements: Record<string, DebugDrawElement> = {};

  drawDebug(options: DebugDrawElement): void {
    const { type, color } = options;
    const id = options?.id ?? Date.now();
    this.debugElements[id] = {
      ...options,
      id: (id || Date.now()).toString(),
      endTime: Date.now() + 1000,
      type,
      color: color ?? ex.Color.Red,
    } as DebugDrawElement;
  }

  drawDebugRect(
    ctx: ex.ExcaliburGraphicsContext,
    element: DebugDrawElementsRect
  ): void {
    const bounds = element.bounds;

    ctx.drawRectangle(
      bounds.topLeft,
      bounds.width,
      bounds.height,
      ex.Color.fromRGB(0, 0, 0, 0),
      element.color ?? ex.Color.Red,
      1
    );
  }

  drawDebugCircle(
    ctx: ex.ExcaliburGraphicsContext,
    element: DebugDrawElementCircle
  ): void {
    ctx.drawCircle(
      element.pos,
      element.radius,
      ex.Color.fromRGB(0, 0, 0, 0),
      element.color ?? ex.Color.Red,
      1
    );
  }

  DebugDrawElementLine(
    ctx: ex.ExcaliburGraphicsContext,
    element: DebugDrawElementLine
  ): void {
    ctx.drawLine(element.pos, element.end, element.color ?? ex.Color.Red, 1);
  }

  onPostDraw(ctx: ex.ExcaliburGraphicsContext, elapsed: number): void {
    super.onPostDraw(ctx, elapsed);
    const debugElements = Object.values(this.debugElements);
    if (debugElements.length > 0) {
      let oldZ = ctx.z;
      let center = this.camera.viewport.topLeft;
      ctx.translate(-center.x, -center.y);
      ctx.z = 100000;
      for (const index in debugElements) {
        if (!debugElements.hasOwnProperty(index)) {
          continue;
        }
        const element = debugElements[index];
        if ((element?.endTime ?? 0) < Date.now()) {
          delete debugElements[index];
          continue;
        }
        switch (element.type) {
          case "rect":
            this.drawDebugRect(ctx, element);
            break;
          case "circle":
            this.drawDebugCircle(ctx, element);
            break;
          case "line":
            this.DebugDrawElementLine(ctx, element);
            break;
        }
      }
      ctx.translate(center.x, center.y);
      ctx.z = oldZ;
    }
  }

  override onActivate(context: ex.SceneActivationContext): void {
    super.onActivate(context);
    if (this.inputSystem == null) {
      let inputSystem = new InputManager();
      this.inputSystem = inputSystem;
      this.add(inputSystem);
    }
  }


  override onDeactivate(context: ex.SceneActivationContext): void {
    this.inputSystem?.suspend();
    super.onDeactivate(context);
  }

  onKeyUp(evt: ExtendedKeyEvent): void {
    if (evt.key === ex.Keys.Escape) this.engine.goToScene("WelcomeScene");
  }
  onKeyDown(_evt: ExtendedKeyEvent): void {
  }
}
