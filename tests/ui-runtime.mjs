// Minimal engine/DOM doubles for unit tests. No browser, canvas, network, or player saves.
export class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  clone() { return vec(this.x, this.y); }
  add(v) { return vec(this.x + v.x, this.y + v.y); }
  sub(v) { return vec(this.x - v.x, this.y - v.y); }
  scale(n) { return vec(this.x * n, this.y * n); }
  equals(v) { return this.x === v.x && this.y === v.y; }
  distance(v) { return Math.hypot(this.x - v.x, this.y - v.y); }
}
export const vec = (x, y) => new Vector(x, y);
export const CoordPlane = { World: "world", Screen: "screen" };
export const CollisionType = { PreventCollision: "prevent", Passive: "passive" };
export class BoundingBox {
  constructor(left = 0, top = 0, right = 0, bottom = 0) { Object.assign(this, { left, top, right, bottom }); }
  get width() { return this.right - this.left; }
  get height() { return this.bottom - this.top; }
  get topLeft() { return vec(this.left, this.top); }
  get center() { return vec((this.left + this.right) / 2, (this.top + this.bottom) / 2); }
  combine(b) { return new BoundingBox(Math.min(this.left, b.left), Math.min(this.top, b.top), Math.max(this.right, b.right), Math.max(this.bottom, b.bottom)); }
  translate(v) { return new BoundingBox(this.left + v.x, this.top + v.y, this.right + v.x, this.bottom + v.y); }
  contains(v) { return v.x >= this.left && v.x <= this.right && v.y >= this.top && v.y <= this.bottom; }
  transform() { return this; }
}
class Events {
  listeners = new Map();
  on(name, callback) {
    const set = this.listeners.get(name) ?? new Set(); this.listeners.set(name, set); set.add(callback);
    return { close: () => set.delete(callback) };
  }
  once(name, callback) { const sub = this.on(name, (...args) => { sub.close(); callback(...args); }); return sub; }
  emit(name, value) { for (const callback of [...(this.listeners.get(name) ?? [])]) callback(value); }
}
let id = 0;
export class Entity extends Events {
  constructor() { super(); this.id = ++id; this.name = ""; this.parent = null; this.children = []; this.scene = null; this.isActive = true; if (!("pos" in this)) this.pos = vec(0, 0); this.scale = vec(1, 1); this.z = 0; }
  get globalZ() { return this.z + (this.parent?.globalZ ?? 0); }
  get globalPos() { return (this.parent?.globalPos ?? vec(0, 0)).add(this.pos); }
  getAncestors() { return this.parent ? [...this.parent.getAncestors(), this] : [this]; }
  addChild(child) { this.children.push(child); child.parent = this; child.scene = this.scene; return this; }
  removeChild(child) { this.children = this.children.filter(value => value !== child); child.parent = null; child.scene = null; return this; }
  isKilled() { return !this.isActive; }
  kill() { this.isActive = false; this.emit("kill"); this.parent?.removeChild(this); }
  onAdd() {} onRemove() {} onPreUpdate() {}
  removeComponent() { return this; }
  addComponent(component) { component.owner = this; return this; }
}
export class TransformComponent {
  pos = vec(0, 0);
  get globalPos() { return (this.owner?.parent?.globalPos ?? vec(0, 0)).add(this.pos); }
}
export class Actor extends Entity {
  constructor(options = {}) { super(); this.body = { collisionType: options.collisionType ?? CollisionType.Passive }; }
  graphics = { opacity: 1, current: undefined, items: new Map(), add(name, graphic) { this.items.set(name, graphic); return graphic; }, use(graphic) { this.current = typeof graphic === "string" ? this.items.get(graphic) : graphic; return this.current; } };
  transform = { get: () => ({ matrix: {}, applyInverse: point => point.sub(this.globalPos) }) };
}
export const AnimationStrategy = { Freeze: "freeze" };
export class Animation { constructor(options) { Object.assign(this, options); this.events = new Events(); } }
export const lerpVector = (a, b, t) => vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
export class Timer {
  constructor(options) { Object.assign(this, options); this.isRunning = false; }
  start() { this.isRunning = true; return this; }
  stop() { this.isRunning = false; return this; }
}
export class Level extends Events {
  entities = [];
  current = true;
  isCurrentScene() { return this.current; }
  onKeyDown() {} onKeyUp() {}
}
export class Color {
  constructor(value = "white") { this.value = value; }
  equal(other) { return this.value === other.value; }
  clone() { return new Color(this.value); }
  darken() { return this.clone(); }
  static fromHex(value) { return new Color(value); }
  static White = new Color(); static Brown = new Color("brown"); static ExcaliburBlue = new Color("blue");
}
export class Graphic {}
export class Rectangle extends Graphic { constructor(options) { super(); Object.assign(this, options); } }
export class NineSlice extends Graphic {}
export class GraphicsGroup { constructor(options) { Object.assign(this, options); } }
export class Sprite extends Graphic { constructor(options = {}) { super(); Object.assign(this, options); } static from() { return new Sprite(); } }
export const FontCache = { clearCache() {} };
export class Font {
  constructor(options) { Object.assign(this, options); }
  measureText(text) { return { width: text.length * this.size * 0.5, height: this.size }; }
}
export class Text extends Graphic { constructor(options) { super(); Object.assign(this, options); } }
export const BaseAlign = { Middle: "middle" };
export const TextAlign = { Left: "left", Center: "center", Right: "right" };
export const PointerType = { Mouse: "Mouse", Touch: "Touch" };
export const PointerButton = { Left: "Left", Right: "Right" };
export const Keys = { Left: "ArrowLeft", Right: "ArrowRight", Up: "ArrowUp", Down: "ArrowDown", Home: "Home", End: "End", Esc: "Escape", Tab: "Tab", Enter: "Enter", Space: "Space" };
export class PointerEvent {
  constructor(type, pointerId, button, pointerType, coordinates, nativeEvent) { Object.assign(this, { type, pointerId, button, pointerType, coordinates, nativeEvent }); }
  get worldPos() { return this.coordinates.worldPos; }
  get screenPos() { return this.coordinates.screenPos; }
}
export class KeyEvent { constructor(key, value, originalEvent) { Object.assign(this, { key, value, originalEvent }); } }
export const getNineslice = () => new NineSlice();
export const getUiBackground = getNineslice;
export const Resources = { Dollar: {} };
export const SoundManager = { play() {} };
const environmentListeners = new Set();
const motionListeners = new Set();
const reducedMotionMedia = { matches: false, addEventListener(_name, listener) { motionListeners.add(listener); } };
globalThis.matchMedia = () => reducedMotionMedia;
export function setReducedMotion(matches) { reducedMotionMedia.matches = matches; for (const listener of motionListeners) listener(); }
export const Settings = { graphics: { advanced: 0, basic: 1 }, sound: { all: 0, nomusic: 1, Off: 2 } };
export const Environment = { isDev: false, data: {}, onChange(listener) { environmentListeners.add(listener); return { close: () => environmentListeners.delete(listener) }; }, get(key, fallback) { return this.data[key] ?? fallback; }, set(key, value) { if (this.data[key] === value) return; this.data[key] = value; for (const listener of environmentListeners) listener(); } };
export class BaseComponent {
  get player() { return this._player; }
  get playerUi() { return this.player.playerUi; }
}
export const PlayerActionTypes = { BUILDABLE: "BUILDABLE", MENU: "MENU" };
const actions = [
  ["NEWDICE", "Buy Dice", 10, true], ["NEWROLLER", "Buy Pawn", 100, false],
  ["NEWKNIGHT", "Buy Wandering Knight", 1000, false], ["BISHOP", "Buy Bishop", 10000, false],
  ["ROOK", "Buy Rook", 125000, false], ["REMOVE", "Remove", 0, true],
].map(([code, name, cost, unlocked]) => ({ code, name, unlocked, type: "BUILDABLE", image: {}, tooltip: name, building: { cost: () => cost } }));
export function getPlayerActions() { return actions; }
class Element {
  constructor() { this.children = []; this.attributes = {}; this.hidden = false; }
  append(child) { this.children.push(child); child.parent = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  contains(child) { return this.children.includes(child); }
  focus() { this.onfocus?.(); }
  blur() { this.onblur?.(); }
  setAttribute(key, value) { this.attributes[key] = value; }
}
class Input extends Element {}
globalThis.HTMLElement = Element;
globalThis.HTMLInputElement = Input;
export const document = { body: new Element(), createElement: tag => tag === "input" ? new Input() : new Element(), fonts: { addEventListener() {}, removeEventListener() {} } };
globalThis.document = document;
globalThis.window = { addEventListener() {}, removeEventListener() {} };
export function engine() {
  const pointer = new Events(); const keyboard = new Events();
  return { screen: { drawWidth: 800, drawHeight: 600, events: new Events() }, input: { pointers: pointer, keyboard } };
}
