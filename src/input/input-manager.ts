import * as ex from "excalibur";
import { Level } from "@src/level";
import { ExtendedPointerEvent } from "./extended-pointer-event";
import { ExtendedKeyEvent } from "./extended-key-event";

export type ButtonStates = "MouseLeft" | "MouseRight" | ex.Keys;
export type InputHandler = ex.Entity & {
  onPointerPressed?(evt: ExtendedPointerEvent): void;
  onPointerDown?(evt: ExtendedPointerEvent): void;
  onPointerUp?(evt: ExtendedPointerEvent): void;
  onPointerCancel?(evt: ExtendedPointerEvent): void;
  onPointerMove?(evt: ExtendedPointerEvent): void;
  onPointerEnter?(evt: ExtendedPointerEvent): void;
  onPointerLeave?(evt: ExtendedPointerEvent): void;
  onDragStart?(evt: ExtendedPointerEvent): void;
  onDragEnd?(evt: ExtendedPointerEvent): void;
  onDragMove?(evt: ExtendedPointerEvent): void;
  onKeyUp?(evt: ExtendedKeyEvent): void;
  onKeyDown?(evt: ExtendedKeyEvent): void;
  onKeyPress?(evt: ExtendedKeyEvent): void;
  onFocusChanged?(focused: boolean): void;
  activate?(evt?: ExtendedPointerEvent): void;
  onActivationKeyChanged?(pressed: boolean): void;
  collides(vec: ex.Vector): boolean;
  screenSpace?: boolean;
  acceptingInputs?: boolean | ButtonStates[];
  rendered?: boolean;
  disabled?: boolean;
  focusable?: boolean;
  accessibleName?: string;
  selected?: boolean;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  globalZ: number;
};

type Press = { owner?: InputHandler; start: ex.Vector; event: ExtendedPointerEvent; dragging: boolean; button: string };
export class InputManager extends ex.Entity {
  static InputManagers: InputManager[] = [];
  static Events = { pointerDown: "im-pointer-down", pointerUp: "im-pointer-up", pointerMove: "im-pointer-move", keyPress: "im-key-press", keyDown: "im-key-down", keyUp: "im-key-up", hoverChange: "im-hover-change", pointerEnter: "im-pointer-enter", pointerLeave: "im-pointer-leave", pointerPressed: "im-pointer-pressed" };
  readonly entities: Record<string, InputHandler> = {};
  readonly buttonStates: Partial<Record<ButtonStates, boolean>> = {};
  private presses = new Map<number, Press>();
  private hovered = new Map<number, InputHandler>();
  private subscriptions: ex.Subscription[] = [];
  private _paused = false;
  private focus?: InputHandler;
  private modals: { entity: InputHandler; close: () => void; previous?: InputHandler }[] = [];
  private accessibleRoot?: HTMLDivElement;
  private registrations = new Map<InputHandler, ex.Subscription>();
  private accessible = new Map<InputHandler, HTMLButtonElement | HTMLInputElement>();
  readonly dragThreshold = 6;
  get level(): Level { return this.scene as Level; }
  get paused(): boolean { return this._paused || !(this.scene?.isCurrentScene() ?? false); }
  set paused(value: boolean) { if (value) this.cancelAll(); this._paused = value; }
  get isDragging(): boolean { return [...this.presses.values()].some(press => press.dragging); }
  get boardPointers(): ex.Vector[] {
    return [...this.presses.values()].filter(press => !press.owner?.focusable && !press.event.handled && press.button === "MouseLeft").map(press => press.event.screenPos);
  }
  get draggingElements(): InputHandler[] { return [...this.presses.values()].flatMap(press => press.owner ? [press.owner] : []); }
  isDown(button: ButtonStates): boolean { return this.buttonStates[button] ?? false; }
  private alive(entity: InputHandler): boolean { return !entity.isKilled() && entity.scene === this.scene && entity.rendered !== false; }
  private inScope(entity: InputHandler): boolean {
    const modal = this.modals.at(-1)?.entity;
    return !modal || entity === modal || entity.getAncestors().includes(modal);
  }
  private eligible(entity: InputHandler): boolean { return this.alive(entity) && !entity.disabled && entity.acceptingInputs !== false && this.inScope(entity); }
  hitTest(event: ExtendedPointerEvent): InputHandler[] {
    let target: InputHandler | undefined;
    let depth = -1;
    for (const entity of Object.values(this.entities)) {
      if (!this.eligible(entity) || !entity.collides(entity.screenSpace ? event.screenPos : event.worldPos)) continue;
      if (Array.isArray(entity.acceptingInputs) && event.type !== "move" && event.type !== "cancel" && !entity.acceptingInputs.includes(this.buttonName(event))) continue;
      const nextDepth = entity.getAncestors().length;
      if (!target || entity.globalZ > target.globalZ || (entity.globalZ === target.globalZ && (nextDepth > depth || (nextDepth === depth && entity.id > target.id)))) {
        target = entity; depth = nextDepth;
      }
    }
    return target ? [target] : [];
  }
  private buttonName(event: ex.PointerEvent): ButtonStates { return event.pointerType === ex.PointerType.Touch ? "MouseLeft" : (`Mouse${event.button}` as ButtonStates); }
  private emitTo(entity: InputHandler | undefined, method: "onPointerDown" | "onPointerUp" | "onPointerMove" | "onPointerPressed" | "onPointerEnter" | "onPointerLeave" | "onPointerCancel" | "onDragStart" | "onDragMove" | "onDragEnd", event: ExtendedPointerEvent, name?: string) {
    if (!entity || !this.alive(entity)) return;
    entity[method]?.(event);
    if (name) entity.emit(name, event);
  }
  private sceneEvent(name: string, event: ExtendedPointerEvent, owner?: InputHandler) {
    // Canvas widgets consume input; board input remains available to the player controller.
    if (!this.modals.length && !owner?.focusable && !event.handled) this.scene?.emit(name, event);
  }
  onPointerDown(evt: ex.PointerEvent): void {
    if (this.paused || this.presses.has(evt.pointerId)) return;
    const event = ExtendedPointerEvent.extend(evt, this);
    this.lastEvent = event;
    const owner = event.entities[0];
    const button = this.buttonName(evt);
    this.buttonStates[button] = true;
    this.presses.set(evt.pointerId, { owner, start: evt.screenPos.clone(), event, dragging: false, button });
    // A multi-pointer board gesture must never activate a cell on release.
    if (this.boardPointers.length > 1) {
      for (const press of this.presses.values()) if (!press.owner?.focusable) press.dragging = true;
    }
    if (owner?.focusable) this.setFocus(owner);
    this.emitTo(owner, "onPointerDown", event, InputManager.Events.pointerDown);
    this.sceneEvent(InputManager.Events.pointerDown, event, owner);
  }
  onPointerUp(evt: ex.PointerEvent): void {
    if (this.paused) return;
    const press = this.presses.get(evt.pointerId);
    if (!press || press.button !== this.buttonName(evt)) return;
    const event = ExtendedPointerEvent.extend(evt, this);
    this.presses.delete(evt.pointerId);
    this.buttonStates[press.button as ButtonStates] = [...this.presses.values()].some(other => other.button === press.button);
    this.emitTo(press.owner, "onPointerUp", event, InputManager.Events.pointerUp);
    if (press.dragging) this.emitTo(press.owner, "onDragEnd", event);
    else if (press.owner && this.eligible(press.owner) && event.entities.includes(press.owner)) this.emitTo(press.owner, "onPointerPressed", event, InputManager.Events.pointerPressed);
    this.sceneEvent(InputManager.Events.pointerUp, event, press.owner);
  }
  onPointerMove(evt: ex.PointerEvent): void {
    if (this.paused) return;
    const event = ExtendedPointerEvent.extend(evt, this);
    this.lastEvent = event;
    const target = event.entities[0];
    const previous = this.hovered.get(evt.pointerId);
    if (previous !== target) {
      this.emitTo(previous, "onPointerLeave", event, InputManager.Events.pointerLeave);
      if (target) { this.hovered.set(evt.pointerId, target); this.emitTo(target, "onPointerEnter", event, InputManager.Events.pointerEnter); }
      else this.hovered.delete(evt.pointerId);
    }
    const press = this.presses.get(evt.pointerId);
    if (press) press.event = event;
    this.emitTo(target, "onPointerMove", event, InputManager.Events.pointerMove);
    if (press && press.owner !== target) this.emitTo(press.owner, "onPointerMove", event, InputManager.Events.pointerMove);
    if (press) {
      if (press.owner && !this.eligible(press.owner)) { this.cancelPointer(evt.pointerId); return; }
      if (!press.dragging && evt.screenPos.distance(press.start) >= this.dragThreshold) {
        press.dragging = true;
        this.emitTo(press.owner, "onDragStart", event);
      }
      if (press.dragging) this.emitTo(press.owner, "onDragMove", event);
    }
    // Hover may hit a UI widget while a board drag owns the pointer.
    this.sceneEvent(InputManager.Events.pointerMove, event, press?.owner ?? target);
  }
  private cancelPointer(id: number) {
    const press = this.presses.get(id);
    if (!press) return;
    this.presses.delete(id);
    this.buttonStates[press.button as ButtonStates] = [...this.presses.values()].some(other => other.button === press.button);
    this.emitTo(press.owner, "onPointerCancel", press.event);
    if (press.dragging) this.emitTo(press.owner, "onDragEnd", press.event);
    this.sceneEvent(InputManager.Events.pointerUp, press.event, press.owner);
  }
  cancelAll = (): void => {
    // Cancellation removes entries from the map; iterate a snapshot.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const id of [...this.presses.keys()]) this.cancelPointer(id);
    for (const key of Object.keys(this.buttonStates)) this.buttonStates[key as ButtonStates] = false;
    for (const [id, owner] of this.hovered) {
      const event = this.lastEvent;
      if (event) this.emitTo(owner, "onPointerLeave", event);
      this.hovered.delete(id);
    }
  };
  private lastEvent?: ExtendedPointerEvent;
  onWheel(evt: ex.WheelEvent): void {
    if (this.paused || this.modals.length) return;
    const coordinates = ex.GlobalCoordinates.fromPagePosition(evt.pageX, evt.pageY, this.level.engine);
    const pointer = ExtendedPointerEvent.extend(new ex.PointerEvent("move", 0, ex.PointerButton.Left, ex.PointerType.Mouse, coordinates, evt.ev), this);
    if (pointer.entities[0]?.focusable) return;
    this.scene?.emit("im-wheel", { delta: evt.deltaY * (evt.deltaMode === ex.WheelDeltaMode.Line ? 16 : evt.deltaMode === ex.WheelDeltaMode.Page ? this.level.engine.screen.resolution.height : 1), screenPos: coordinates.screenPos });
  }
  private focusable(): InputHandler[] { return Object.values(this.entities).filter(entity => entity.focusable && this.eligible(entity)); }
  setFocus(entity?: InputHandler): void {
    if (entity && (!entity.focusable || !this.eligible(entity))) return;
    if (entity === this.focus) return;
    const previous = this.focus;
    this.focus?.onFocusChanged?.(false);
    this.focus = entity;
    entity?.onFocusChanged?.(true);
    if (entity) this.accessible.get(entity)?.focus({ preventScroll: true });
    else if (previous && document.activeElement === this.accessible.get(previous)) this.accessible.get(previous)?.blur();
    if (entity) {
      for (const ancestor of entity.getAncestors()) {
        const scrollable = ancestor as ex.Entity & { reveal?: (entity: InputHandler) => void };
        scrollable.reveal?.(entity);
      }
    }
  }
  pushModal(entity: InputHandler, close: () => void): void {
    if (this.modals.some(modal => modal.entity === entity)) return;
    this.cancelAll();
    this.modals.push({ entity, close, previous: this.focus });
    this.setFocus(this.focusable()[0]);
    this.syncAccessibility();
  }
  popModal(entity: InputHandler): void {
    const index = this.modals.findIndex(modal => modal.entity === entity);
    if (index < 0) return;
    const [modal] = this.modals.splice(index, 1);
    this.cancelAll();
    this.setFocus(modal.previous && this.eligible(modal.previous) ? modal.previous : this.focusable()[0]);
    this.syncAccessibility();
  }
  private key(evt: ex.KeyEvent, method: "onKeyDown" | "onKeyUp" | "onKeyPress", name: string) {
    if (this.paused) return;
    const event = ExtendedKeyEvent.extend(evt, this);
    if (method !== "onKeyPress") this.buttonStates[evt.key] = method === "onKeyDown";
    if (evt.originalEvent?.target instanceof HTMLElement && this.accessibleRoot?.contains(evt.originalEvent.target)) return;
    if (evt.key === ex.Keys.Tab) {
      evt.originalEvent?.preventDefault();
      if (method === "onKeyDown") {
        const widgets = this.focusable();
        const direction = evt.originalEvent?.shiftKey ? -1 : 1;
        const index = this.focus ? widgets.indexOf(this.focus) : -1;
        this.setFocus(widgets[(index + direction + widgets.length) % widgets.length]);
      }
      return;
    }
    if (evt.key === ex.Keys.Esc && this.modals.length) { if (method === "onKeyUp") this.modals.at(-1)?.close(); return; }
    if (this.focus && this.eligible(this.focus)) {
      if (evt.key === ex.Keys.Enter || evt.key === ex.Keys.Space) {
        evt.originalEvent?.preventDefault();
        if (method !== "onKeyPress") this.focus.onActivationKeyChanged?.(method === "onKeyDown");
        if (method === "onKeyUp") this.focus.activate?.();
        return;
      }
      this.focus[method]?.(event);
    }
    if (this.modals.length) return;
    if (method === "onKeyDown") this.level.onKeyDown(event);
    if (method === "onKeyUp") this.level.onKeyUp(event);
    for (const entity of Object.values(this.entities)) {
      if (!entity.focusable && this.eligible(entity)) { entity[method]?.(event); entity.emit(name, event); }
    }
  }
  onKeyDown(evt: ex.KeyEvent): void { this.key(evt, "onKeyDown", InputManager.Events.keyDown); }
  onKeyUp(evt: ex.KeyEvent): void { this.key(evt, "onKeyUp", InputManager.Events.keyUp); }
  onKeyPress(evt: ex.KeyEvent): void { this.key(evt, "onKeyPress", InputManager.Events.keyPress); }
  /** Semantic companions expose canvas controls to assistive technology. */
  syncAccessibility(): void {
    if (this.accessibleRoot) {
      this.accessibleRoot.setAttribute("role", this.modals.length ? "dialog" : "group");
      this.accessibleRoot.setAttribute("aria-modal", this.modals.length ? "true" : "false");
    }
    if (this.accessibleRoot && this.accessibleRoot.hidden !== this.paused) this.accessibleRoot.hidden = this.paused;
    for (const entity of this.accessible.keys()) this.updateAccessible(entity);
  }
  private updateAccessible(entity: InputHandler) {
    this.addAccessible(entity);
    const element = this.accessible.get(entity);
    if (!element) return;
    element.hidden = !this.alive(entity) || !this.inScope(entity);
    element.disabled = !!entity.disabled;
    element.setAttribute("aria-label", entity.accessibleName || "Control");
    if (typeof entity.selected === "boolean") element.setAttribute("aria-pressed", String(entity.selected));
    if (element instanceof HTMLInputElement) {
      element.min = String(entity.min); element.max = String(entity.max); element.step = String(entity.step); element.value = String(entity.value);
    }
  }
  static updateAccessibility(entity: InputHandler): void {
    if (entity.scene instanceof Level) entity.scene.inputSystem?.updateAccessible(entity);
  }
  private addAccessible(entity: InputHandler) {
    if (!entity.focusable || this.accessible.has(entity) || !this.accessibleRoot) return;
    const element = entity.value === undefined ? document.createElement("button") : document.createElement("input");
    if (element instanceof HTMLInputElement) { element.type = "range"; element.oninput = () => { if (!this.eligible(entity)) return; entity.value = Number(element.value); this.setFocus(entity); }; }
    else element.onclick = () => { if (!this.eligible(entity)) return; this.setFocus(entity); entity.activate?.(); };
    element.onfocus = () => this.setFocus(entity);
    element.onblur = () => { entity.onActivationKeyChanged?.(false); if (this.focus === entity) this.setFocus(); };
    element.onkeydown = event => {
      if ((event.key === "Enter" || event.key === " ") && this.eligible(entity)) entity.onActivationKeyChanged?.(true);
      if (event.key === "Tab") {
        event.preventDefault();
        const widgets = this.focusable();
        const index = widgets.indexOf(entity);
        const next = widgets[(index + (event.shiftKey ? -1 : 1) + widgets.length) % widgets.length];
        this.setFocus(next);
        if (next) this.accessible.get(next)?.focus();
      }
      if (event.key === "Escape" && this.modals.length) { event.preventDefault(); this.modals.at(-1)?.close(); }
    };
    element.onkeyup = event => { if (event.key === "Enter" || event.key === " ") entity.onActivationKeyChanged?.(false); };
    this.accessibleRoot.append(element);
    this.accessible.set(entity, element);
  }
  static register(entity: InputHandler): void {
    const scene = entity.scene;
    if (!(scene instanceof Level) || !scene.inputSystem) return;
    const manager = scene.inputSystem;
    if (entity.acceptingInputs === false) { InputManager.unregister(entity, scene); return; }
    if (manager.entities[entity.id]) { manager.addAccessible(entity); return; }
    manager.entities[entity.id] = entity;
    manager.addAccessible(entity);
    manager.updateAccessible(entity);
    manager.registrations.set(entity, entity.once("kill", () => InputManager.unregister(entity, scene)));
  }
  static unregister(entity: InputHandler, scene?: ex.Scene | null): void {
    if (!(scene instanceof Level) || !scene.inputSystem) return;
    const manager = scene.inputSystem;
    delete manager.entities[entity.id];
    manager.registrations.get(entity)?.close();
    manager.registrations.delete(entity);
    for (const [id, press] of manager.presses) if (press.owner === entity) manager.cancelPointer(id);
    if (manager.focus === entity) manager.setFocus();
    for (const [id, target] of manager.hovered) if (target === entity) manager.hovered.delete(id);
    manager.accessible.get(entity)?.remove();
    manager.accessible.delete(entity);
  }
  override onAdd(engine: ex.Engine): void {
    super.onAdd(engine);
    this.level.inputSystem = this;
    if (!InputManager.InputManagers.includes(this)) InputManager.InputManagers.push(this);
    this.accessibleRoot = document.createElement("div");
    this.accessibleRoot.className = "canvas-controls";
    this.accessibleRoot.setAttribute("aria-label", "Game controls");
    document.body.append(this.accessibleRoot);
    const pointer = engine.input.pointers;
    this.subscriptions.push(pointer.on("down", event => this.onPointerDown(event)), pointer.on("up", event => this.onPointerUp(event)),
      pointer.on("wheel", event => this.onWheel(event)),
      pointer.on("move", event => { this.lastEvent = ExtendedPointerEvent.extend(event, this); this.onPointerMove(event); }),
      pointer.on("cancel", event => { if (event instanceof ex.PointerEvent) this.cancelPointer(event.pointerId); }),
      engine.input.keyboard.on("down", event => { if (event instanceof ex.KeyEvent) this.onKeyDown(event); }), engine.input.keyboard.on("up", event => { if (event instanceof ex.KeyEvent) this.onKeyUp(event); }), engine.input.keyboard.on("press", event => this.onKeyPress(event)));
    window.addEventListener("blur", this.cancelAll);
  }
  suspend(): void { this.cancelAll(); this.setFocus(); if (this.accessibleRoot) this.accessibleRoot.hidden = true; }
  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    // Popping a modal mutates the stack; preserve this iteration.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const modal of [...this.modals]) if (!this.alive(modal.entity)) this.popModal(modal.entity);
    if (this.focus && !this.eligible(this.focus)) this.setFocus(this.focusable()[0]);
    if (this.accessibleRoot && this.accessibleRoot.hidden !== this.paused) this.accessibleRoot.hidden = this.paused;
  }
  override onRemove(engine: ex.Engine): void {
    this.suspend();
    this.subscriptions.forEach(sub => sub.close()); this.subscriptions = [];
    window.removeEventListener("blur", this.cancelAll);
    this.accessibleRoot?.remove(); this.accessibleRoot = undefined; this.accessible.clear();
    for (const entity of Object.values(this.entities)) InputManager.unregister(entity, this.scene);
    this.modals = [];
    InputManager.InputManagers = InputManager.InputManagers.filter(manager => manager !== this);
    super.onRemove(engine);
  }
}
