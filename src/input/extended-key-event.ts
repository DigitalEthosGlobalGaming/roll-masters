import * as ex from "excalibur";
import type { ButtonStates, InputManager } from "./input-manager";
export class ExtendedKeyEvent extends ex.KeyEvent {
  constructor(evt: ex.KeyEvent, readonly inputManager: InputManager) { super(evt.key, evt.value, evt.originalEvent); }
  static extend(evt: ex.KeyEvent, manager: InputManager): ExtendedKeyEvent { return new ExtendedKeyEvent(evt, manager); }
  isDown(button: ButtonStates): boolean { return this.inputManager.isDown(button); }
}
