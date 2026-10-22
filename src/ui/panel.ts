import * as ex from "excalibur";
import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";
import { InputManager } from "@src/input/input-manager";
import type { ButtonStates, InputHandler } from "@src/input/input-manager";
import { getUiBackground } from "@src/resources";

export enum PanelBackgrounds { Panel = "Panel", Button = "Button" }

/** Retained widget: setup once, refresh state, measure/arrange, then paint. */
export class Panel extends ex.Actor implements InputHandler {
  /** Instance-owned listeners survive detach/re-add and close on kill. */
  subscriptions: ex.Subscription[] = [];
  private attachmentSubscriptions: ex.Subscription[] = [];
  isHovered = false;
  isMouseDown = false;
  focusable = false;
  focused = false;
  private _disabled = false;
  get disabled(): boolean { return this._disabled; }
  set disabled(value: boolean) { if (value !== this._disabled) { this._disabled = value; this.invalidatePaint(); } }
  accessibleName = "";
  services: { showTooltip?: (value: unknown) => void; hideTooltip?: (value: unknown) => void } = {};
  /** Screen-plane descendants use screen coordinates for hit testing as well as drawing. */
  get screenSpace(): boolean { return this.parentPanel?.screenSpace ?? this.transform.coordPlane === ex.CoordPlane.Screen; }
  private setupDone = false;
  private attachedScene?: ex.Scene | null;
  private refreshDirty = true;
  private layoutDirty = true;
  private paintDirty = true;
  private subtreeDirty = true;
  private measuring = false;
  private measureDirty = true;
  private panels: Panel[] = [];
  private namedPanels = new Map<string, Panel>();
  private measuredBounds = new ex.BoundingBox(0, 0, 0, 0);
  private explicitSize?: ex.Vector;
  private backgroundGraphic?: ex.Graphic;
  private backgroundKey = "";
  private graphicsGroup = new ex.GraphicsGroup({ useAnchor: false, members: [] });
  readonly metrics = { setups: 0, refreshes: 0, layouts: 0, paints: 0 };

  constructor(parent?: Panel | null) {
    super();
    this.graphics.use(this.graphicsGroup);
    parent?.addChild(this);
  }
  get parentPanel(): Panel | null { return this.parent instanceof Panel ? this.parent : null; }
  get dirty(): boolean { return this.refreshDirty; }
  set dirty(value: boolean) { if (value) this.invalidate(); }
  set allDirty(value: boolean) {
    if (!value) return;
    this.invalidate();
    for (const child of this.panels) child.allDirty = true;
  }
  get isChildDirty(): boolean { return this.panels.some(child => child.subtreeDirty); }
  private wake() {
    if (this.subtreeDirty) return;
    this.subtreeDirty = true;
    this.parentPanel?.wake();
  }
  invalidate() { this.refreshDirty = true; this.invalidateLayout(); }
  invalidatePaint() { this.paintDirty = true; this.wake(); }
  invalidateLayout() {
    this.layoutDirty = true;
    this.measureDirty = true;
    this.invalidatePaint();
    this.parentPanel?.invalidateLayout();
  }
  ensureSetup() {
    if (this.setupDone) return;
    this.setupDone = true;
    this.metrics.setups++;
    this.onSetup();
  }
  onSetup(): void { }
  onRefresh(): void { }
  onLayout(): void { }
  onRender(): void { }
  onResize(_oldSize: ex.Vector, _newSize: ex.Vector): void { }
  onViewportChanged(): void { this.invalidateLayout(); }

  private _visible = true;
  get visible(): boolean { return this._visible && (this.parentPanel?.visible ?? true); }
  set visible(value: boolean) {
    if (value === this._visible) return;
    this._visible = value;
    this.onVisibleChanged(value);
    this.invalidateVisibility();
  }
  private invalidateVisibility() {
    this.refreshDirty = true;
    this.invalidatePaint();
    for (const child of this.panels) child.invalidateVisibility();
  }
  onVisibleChanged(_visible: boolean): void { }
  private _collapsed = false;
  get collapsed(): boolean { return this._collapsed; }
  set collapsed(value: boolean) {
    if (value === this._collapsed) return;
    this._collapsed = value;
    this.invalidateLayout();
    this.invalidateVisibility();
  }
  get rendered(): boolean { return this._visible && !this.collapsed && (this.parentPanel?.rendered ?? true); }
  private _padding = 0;
  get padding(): number { return this._padding; }
  set padding(value: number) {
    value = Math.max(0, Number.isFinite(value) ? value : 0);
    if (value === this._padding) return;
    this._padding = value;
    this.invalidateLayout();
  }
  private _color = ex.Color.White;
  get color(): ex.Color { return this._color; }
  set color(value: ex.Color) { if (!this._color.equal(value)) { this._color = value; this.invalidatePaint(); } }
  private _backgroundColor: ex.Color | null = null;
  get backgroundColor(): ex.Color | null { return this._backgroundColor; }
  set backgroundColor(value: ex.Color | null) {
    if (this._backgroundColor === value || (value && this._backgroundColor?.equal(value))) return;
    this._backgroundColor = value;
    this.invalidatePaint();
  }
  private _background: PanelBackgrounds | null = null;
  get background(): PanelBackgrounds | null { return this._background; }
  set background(value: PanelBackgrounds | null) { if (value !== this._background) { this._background = value; this.invalidatePaint(); } }
  get screenSize(): ex.Vector { return ex.vec(this.screenWidth, this.screenHeight); }
  get screenWidth(): number { return this.scene?.engine.screen.resolution?.width ?? this.scene?.engine.screen.drawWidth ?? 0; }
  get screenHeight(): number { return this.scene?.engine.screen.resolution?.height ?? this.scene?.engine.screen.drawHeight ?? 0; }
  get size(): ex.Vector { this.calculateSize(); return ex.vec(this.measuredBounds.width, this.measuredBounds.height); }
  /** Explicit dimensions include padding. Hidden retains geometry; collapsed does not. */
  set size(value: ex.Vector) {
    const next = ex.vec(Math.max(0, Number.isFinite(value.x) ? value.x : 0), Math.max(0, Number.isFinite(value.y) ? value.y : 0));
    if (this.explicitSize?.equals(next)) return;
    this.explicitSize = next;
    this.invalidateLayout();
  }
  useContentSize() { if (this.explicitSize) { this.explicitSize = undefined; this.invalidateLayout(); } }
  get width(): number { return this.size.x; }
  get height(): number { return this.size.y; }
  get halfWidth(): number { return this.width / 2; }
  get halfHeight(): number { return this.height / 2; }
  get halfSize(): ex.Vector { return this.size.scale(0.5); }
  get localBounds(): ex.BoundingBox { this.calculateSize(); return this.measuredBounds; }
  get bounds(): ex.BoundingBox { return this.localBounds.translate(this.pos); }
  get globalBounds(): ex.BoundingBox { return this.localBounds.transform(this.transform.get().matrix); }
  get innerWidth(): number { return Math.max(0, this.width - this.padding * 2); }
  /** Auto panels preserve child coordinates; the union may have an off-center origin. */
  protected measure(): ex.BoundingBox {
    const children = this.panels.filter(child => !child.collapsed);
    if (!children.length) return new ex.BoundingBox(-this.padding, -this.padding, this.padding, this.padding);
    let bounds = children[0].bounds;
    for (let i = 1; i < children.length; i++) bounds = bounds.combine(children[i].bounds);
    return new ex.BoundingBox(bounds.left - this.padding, bounds.top - this.padding,
      bounds.right + this.padding, bounds.bottom + this.padding);
  }
  calculateSize(): void {
    if (!this.measureDirty || this.measuring) return;
    this.measuring = true;
    const old = ex.vec(this.measuredBounds.width, this.measuredBounds.height);
    this.measuredBounds = this.explicitSize
      ? this.centeredSize(this.explicitSize.x, this.explicitSize.y) : this.measure();
    this.measuring = false;
    this.measureDirty = false;
    const next = ex.vec(this.measuredBounds.width, this.measuredBounds.height);
    if (!old.equals(next)) {
      this.onResize(old, next);
      this.emit("resize", { oldSize: old, newSize: next });
    }
  }
  protected centeredSize(width: number, height: number): ex.BoundingBox {
    return new ex.BoundingBox(-width / 2, -height / 2, width / 2, height / 2);
  }
  get top(): number { return this.pos.y + this.localBounds.top; }
  set top(value: number) { this.yPos = value - this.localBounds.top; }
  get bottom(): number { return this.pos.y + this.localBounds.bottom; }
  set bottom(value: number) { this.yPos = value - this.localBounds.bottom; }
  get left(): number { return this.pos.x + this.localBounds.left; }
  set left(value: number) { this.xPos = value - this.localBounds.left; }
  get right(): number { return this.pos.x + this.localBounds.right; }
  set right(value: number) { this.xPos = value - this.localBounds.right; }
  get center(): ex.Vector { return this.bounds.center; }
  set center(value: ex.Vector) { const next = value.sub(this.localBounds.center); if (!next.equals(this.pos)) { this.pos = next; this.parentPanel?.invalidateLayout(); } }
  get xPos(): number { return this.pos.x; }
  set xPos(value: number) { if (value !== this.pos.x) { this.pos.x = value; this.parentPanel?.invalidateLayout(); } }
  get yPos(): number { return this.pos.y; }
  set yPos(value: number) { if (value !== this.pos.y) { this.pos.y = value; this.parentPanel?.invalidateLayout(); } }
  get topCenter(): ex.Vector { return ex.vec(this.center.x, this.top); }
  set topCenter(value: ex.Vector) { this.center = ex.vec(value.x, this.center.y); this.top = value.y; }
  get bottomCenter(): ex.Vector { return ex.vec(this.center.x, this.bottom); }
  set bottomCenter(value: ex.Vector) { this.center = ex.vec(value.x, this.center.y); this.bottom = value.y; }
  get leftCenter(): ex.Vector { return ex.vec(this.left, this.center.y); }
  set leftCenter(value: ex.Vector) { this.center = ex.vec(this.center.x, value.y); this.left = value.x; }
  get rightCenter(): ex.Vector { return ex.vec(this.right, this.center.y); }
  set rightCenter(value: ex.Vector) { this.center = ex.vec(this.center.x, value.y); this.right = value.x; }
  get topLeft(): ex.Vector { return ex.vec(this.left, this.top); }
  set topLeft(value: ex.Vector) { this.left = value.x; this.top = value.y; }
  get topRight(): ex.Vector { return ex.vec(this.right, this.top); }
  set topRight(value: ex.Vector) { this.right = value.x; this.top = value.y; }
  get bottomLeft(): ex.Vector { return ex.vec(this.left, this.bottom); }
  set bottomLeft(value: ex.Vector) { this.left = value.x; this.bottom = value.y; }
  get bottomRight(): ex.Vector { return ex.vec(this.right, this.bottom); }
  set bottomRight(value: ex.Vector) { this.right = value.x; this.bottom = value.y; }
  override addChild(entity: ex.Entity): ex.Entity {
    const result = super.addChild(entity);
    if (entity instanceof Panel && !this.panels.includes(entity)) { this.panels.push(entity); this.invalidateLayout(); }
    return result;
  }
  override removeChild(entity: ex.Entity): ex.Entity {
    if (entity instanceof Panel) {
      this.panels = this.panels.filter(child => child !== entity);
      this.namedPanels.delete(entity.name);
      this.invalidateLayout();
    }
    return super.removeChild(entity);
  }
  getChildrenPanels(): Panel[] { return this.panels.filter(child => !child.isKilled()); }
  getPanelChildren(): Panel[] { return this.getChildrenPanels(); }
  getPanel<T = Panel>(name: string): T | null { return (this.namedPanels.get(name) as T) ?? null; }
  getChild(name: string): Panel | null { return this.getPanel(name); }
  hasPanel(name: string): boolean { return this.namedPanels.has(name); }
  addPanel<T extends Panel, A extends unknown[]>(name: string, PanelClass: new (parent: Panel, ...args: A) => T, ...args: A): T {
    const existing = this.namedPanels.get(name);
    if (existing && !existing.isKilled()) {
      if (!(existing instanceof PanelClass)) throw new Error(`Panel '${name}' already has a different widget type`);
      return existing;
    }
    const panel = new PanelClass(this, ...args);
    panel.name = name;
    if (panel.parent !== this) this.addChild(panel);
    this.namedPanels.set(name, panel);
    return panel;
  }
  removePanel(panel: string | Panel) {
    const child = typeof panel === "string" ? this.namedPanels.get(panel) : panel;
    if (!child) return;
    child.kill();
  }
  removeAllPanels() {
    // Keep a snapshot because removing children updates the panel collection.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const child of [...this.panels]) this.removePanel(child);
  }
  getParent<T = Panel>(): T | null { return this.parentPanel as T | null; }
  getParentBounds(): ex.BoundingBox { return this.parentPanel?.localBounds ?? new ex.BoundingBox(0, 0, this.screenWidth, this.screenHeight); }
  getService<K extends keyof Panel["services"]>(name: K): Panel["services"][K] { return this.services[name] ?? this.parentPanel?.getService(name); }
  private _acceptingInputs: boolean | ButtonStates[] = false;
  get acceptingInputs(): boolean | ButtonStates[] { return this._acceptingInputs; }
  set acceptingInputs(value: boolean | ButtonStates[]) { this._acceptingInputs = value; if (this.scene) InputManager.register(this); }
  collides(world: ex.Vector): boolean { return this.rendered && !this.disabled && this.acceptingInputs !== false && this.isInBounds(world); }
  isInBounds(world: ex.Vector): boolean { return this.localBounds.contains(this.transform.get().applyInverse(world)); }
  onPointerEnter(e: ExtendedPointerEvent): void { if (!this.isHovered) { this.isHovered = true; this.onHoverChanged(e); } }
  onPointerLeave(e: ExtendedPointerEvent): void { if (this.isHovered) { this.isHovered = false; this.onHoverChanged(e); } }
  onPointerDown(_e: ExtendedPointerEvent): void { this.isMouseDown = true; this.invalidatePaint(); }
  onPointerUp(_e: ExtendedPointerEvent): void { this.isMouseDown = false; this.invalidatePaint(); }
  onPointerCancel(_e: ExtendedPointerEvent): void { this.isMouseDown = false; this.invalidatePaint(); }
  onHoverChanged(_e: ExtendedPointerEvent): void { this.invalidatePaint(); }
  onFocusChanged(value: boolean): void { this.focused = value; this.invalidatePaint(); }
  get graphicCount(): number { return this.graphicsGroup.members.length; }
  clearGraphics() { this.graphicsGroup.members = []; this.backgroundGraphic = undefined; this.backgroundKey = ""; }
  addGraphic(graphic: ex.Graphic, offset = ex.vec(0, 0), behind = false) {
    const member = { graphic, offset };
    if (behind) this.graphicsGroup.members.unshift(member);
    else this.graphicsGroup.members.push(member);
    return member;
  }
  removeGraphic(graphic: ex.Graphic) { this.graphicsGroup.members = this.graphicsGroup.members.filter(member => !("graphic" in member && member.graphic === graphic)); }
  protected get backgroundTint(): ex.Color { return this.backgroundColor ?? ex.Color.White; }
  protected updateBackground() {
    const bounds = this.localBounds;
    const key = `${this.background}:${bounds.left}:${bounds.top}:${bounds.width}:${bounds.height}`;
    if (key !== this.backgroundKey) {
      if (this.backgroundGraphic) this.graphicsGroup.members = this.graphicsGroup.members.filter(member => !("graphic" in member && member.graphic === this.backgroundGraphic));
      this.backgroundGraphic = undefined;
      if (this.background && bounds.width > 0 && bounds.height > 0) {
        this.backgroundGraphic = getUiBackground({ name: this.background, width: bounds.width, height: bounds.height });
        this.graphicsGroup.members.unshift({ graphic: this.backgroundGraphic, offset: bounds.topLeft });
      }
      this.backgroundKey = key;
    }
    if (this.backgroundGraphic) this.backgroundGraphic.tint = this.backgroundTint;
  }
  private refreshTree() {
    this.ensureSetup();
    if (this.refreshDirty) { this.refreshDirty = false; this.metrics.refreshes++; this.onRefresh(); }
    for (const child of this.panels) if (child.subtreeDirty) child.refreshTree();
  }
  private layoutTree() {
    for (const child of this.panels) if (child.subtreeDirty) child.layoutTree();
    if (!this.layoutDirty) return;
    this.layoutDirty = false;
    this.calculateSize();
    this.metrics.layouts++;
    this.onLayout();
  }
  private paintTree() {
    if (this.paintDirty) {
      this.paintDirty = false;
      this.metrics.paints++;
      this.graphics.opacity = this.rendered ? 1 : 0;
      this.updateBackground();
      this.onRender();
      InputManager.updateAccessibility(this);
    }
    for (const child of this.panels) if (child.subtreeDirty) child.paintTree();
    this.subtreeDirty = this.refreshDirty || this.layoutDirty || this.paintDirty || this.panels.some(child => child.subtreeDirty);
  }
  private hasPendingLayout(): boolean {
    return this.refreshDirty || this.layoutDirty || this.panels.some(child => child.hasPendingLayout());
  }
  /** Resolve dependent geometry before painting; cap work for unstable layouts. */
  render(): void {
    // Excalibur defers removal; a retired root can still receive its queued update.
    if (this.isKilled() || !this.subtreeDirty) return;
    for (let pass = 0; pass < 12; pass++) {
      this.refreshTree();
      this.layoutTree();
      if (!this.hasPendingLayout()) break;
    }
    this.paintTree();
  }
  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    if (!this.parentPanel) this.render();
  }
  override onAdd(engine: ex.Engine): void {
    super.onAdd(engine);
    this.attachedScene = this.scene;
    this.ensureSetup();
    InputManager.register(this);
    if (!this.parentPanel) {
      this.attachmentSubscriptions.push(engine.screen.events.on("resize", () => this.onViewportChanged()));
      const fontsChanged = () => { ex.FontCache.clearCache(); this.allDirty = true; };
      document.fonts?.addEventListener("loadingdone", fontsChanged);
      this.attachmentSubscriptions.push({ close: () => document.fonts?.removeEventListener("loadingdone", fontsChanged) });
    }
    this.onViewportChanged();
    this.invalidate();
  }
  override onRemove(engine: ex.Engine): void {
    this.isHovered = false;
    this.isMouseDown = false;
    this.onFocusChanged(false);
    InputManager.unregister(this, this.scene ?? this.attachedScene);
    for (const subscription of this.attachmentSubscriptions) subscription.close();
    this.attachmentSubscriptions = [];
    super.onRemove(engine);
  }
  override kill(): void {
    // Keep a snapshot because killing children updates the panel collection.
    // oxlint-disable-next-line unicorn/no-useless-spread
    for (const child of [...this.panels]) child.kill();
    InputManager.unregister(this, this.scene ?? this.attachedScene);
    for (const subscription of this.subscriptions) subscription.close();
    this.subscriptions = [];
    for (const subscription of this.attachmentSubscriptions) subscription.close();
    this.attachmentSubscriptions = [];
    if (this.scene) super.kill();
    else { this.isActive = false; this.parentPanel?.removeChild(this); }
  }
}
