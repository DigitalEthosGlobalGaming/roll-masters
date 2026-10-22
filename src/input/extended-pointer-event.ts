import * as ex from "excalibur";
import type { InputManager, InputHandler, ButtonStates } from "./input-manager";

/** Per-dispatch wrapper; the engine event remains untouched. */
export class ExtendedPointerEvent extends ex.PointerEvent {
  private resolved?: InputHandler[];
  handled = false;
  constructor(readonly original: ex.PointerEvent, readonly inputManager: InputManager) {
    super(original.type, original.pointerId, original.button, original.pointerType, original.coordinates, original.nativeEvent);
  }
  static extend(evt: ex.PointerEvent, manager: InputManager): ExtendedPointerEvent { return new ExtendedPointerEvent(evt, manager); }
  get entities(): InputHandler[] { return this.resolved ??= this.inputManager.hitTest(this); }
  set entities(value: InputHandler[]) { this.resolved = value; }
  isDown(button: ButtonStates): boolean { return this.inputManager.isDown(button); }
  stopPropagation(): void { this.handled = true; }
}
