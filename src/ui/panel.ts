import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";
import {
  ButtonStates,
  InputHandler,
  InputManager,
} from "@src/input/input-manager";
import { Level } from "@src/level";
import { Player } from "@src/player-systems/player";
import { getNineslice } from "@src/resources";
import * as ex from "excalibur";

export enum PanelBackgrounds {
  "Panel" = "Panel",
  "Button" = "Button",
}

type DirtyPanels = {
  element: Panel;
  children: DirtyPanels[];
};

export class Panel extends ex.Actor implements InputHandler {
  lastRenderTick = -1;
  isHovered = false;
  isMouseDown = false;
  needsRender = true;
  dirty = true;

  subscriptions: ex.Subscription[] = [];

  set allDirty(value: boolean) {
    this.dirty = value;
    for (let child of this.getChildrenPanels()) {
      child.allDirty = value;
    }
  }

  // Positional Setters and Getters
  /**
   *
   * These are used to set and get the related position of the panel.
   * This takes into account the size of the panel.
   * Important thing to note is that by default panels are anchored at the center.
   */

  get topCenter(): ex.Vector {
    return ex.vec(0, this.top);
  }
  set topCenter(value: ex.Vector) {
    this.top = value.y;
  }

  get bottomCenter(): ex.Vector {
    return ex.vec(0, this.bottom);
  }
  set bottomCenter(value: ex.Vector) {
    this.bottom = value.y;
    this.xPos = value.x;
  }

  get leftCenter(): ex.Vector {
    return ex.vec(this.left, 0);
  }
  set leftCenter(value: ex.Vector) {
    this.left = value.x;
  }

  get rightCenter(): ex.Vector {
    return ex.vec(this.right, 0);
  }
  set rightCenter(value: ex.Vector) {
    this.right = value.x;
  }

  get topLeft(): ex.Vector {
    return ex.vec(this.left, this.top);
  }
  set topLeft(value: ex.Vector) {
    this.left = value.x;
    this.top = value.y;
  }

  get topRight(): ex.Vector {
    return ex.vec(this.right, this.top);
  }
  set topRight(value: ex.Vector) {
    this.right = value.x;
    this.top = value.y;
  }

  get bottomLeft(): ex.Vector {
    return ex.vec(this.left, this.bottom);
  }
  set bottomLeft(value: ex.Vector) {
    this.left = value.x;
    this.bottom = value.y;
  }

  get bottomRight(): ex.Vector {
    return ex.vec(this.right, this.bottom);
  }
  set bottomRight(value: ex.Vector) {
    this.right = value.x;
    this.bottom = value.y;
  }

  get top(): number {
    return -this.halfHeight + this.pos.y;
  }
  set top(value: number) {
    this.pos.y = value + this.halfHeight;
  }

  get bottom(): number {
    return this.halfHeight + this.pos.y;
  }
  set bottom(value: number) {
    this.pos.y = value - this.halfHeight;
  }

  get left(): number {
    return -this.halfWidth + this.pos.x;
  }
  set left(value: number) {
    this.pos.x = value + this.halfWidth;
  }

  get right(): number {
    return this.halfWidth + this.pos.x;
  }
  set right(value: number) {
    this.pos.x = value - this.halfWidth;
  }

  get center(): ex.Vector {
    return ex.vec(this.pos.x, this.pos.y);
  }
  set center(value: ex.Vector) {
    this.pos.x = value.x;
    this.pos.y = value.y;
  }
  get yPos(): number {
    return this.pos.y;
  }
  set yPos(value: number) {
    this.pos.y = value;
  }
  get xPos(): number {
    return this.pos.x;
  }
  set xPos(value: number) {
    this.pos.x = value;
  }

  get height(): number {
    return this.size.y;
  }
  get width(): number {
    return this.size.x;
  }
  get halfHeight(): number {
    return this.height / 2;
  }
  get halfWidth(): number {
    return this.width / 2;
  }

  get level(): Level {
    if (this.scene instanceof Level) {
      return this.scene;
    }
    throw new Error("Scene is not a Level");
  }

  get player(): Player | undefined {
    return this.level.player;
  }
  get parentPanel(): Panel | null {
    return this.parent instanceof Panel ? this.parent : null;
  }

  private graphicsGroup!: ex.GraphicsGroup;

  _visible = true;
  get visible(): boolean {
    if (this._visible == false) {
      return false;
    }

    if (this.parent instanceof Panel) {
      return this.parent.visible;
    }
    return true;
  }
  set visible(value: boolean) {
    if (value == this._visible) {
      return;
    }
    this._visible = value;
    this.onVisibleChanged(value);
    this.allDirty = true;
  }

  onVisibleChanged(_visible: boolean) {

  }

  _padding = 0;
  get padding(): number {
    return this._padding;
  }
  set padding(value: number) {
    this._padding = value;
    this.dirty = true;
  }

  get screenSize(): ex.Vector {
    let screen = this.scene?.engine.screen;
    return ex.vec(screen?.width ?? 0, screen?.drawHeight ?? 0);
  }
  get screenWidth(): number {
    let screen = this.scene?.engine.screen;
    return screen?.drawWidth ?? 0;
  }
  get screenHeight(): number {
    let screen = this.scene?.engine.screen;
    return screen?.drawHeight ?? 0;
  }

  _size: ex.Vector | undefined = undefined;
  _customSize: boolean = false;

  get halfSize(): ex.Vector {
    return this.size.clone().scale(0.5);
  }
  get size(): ex.Vector {
    if (this.visible == false) {
      return ex.vec(0, 0);
    }
    if (this._customSize) {
      let size = this._size ?? new ex.Vector(this.width, this.height);
      if (this.padding) {
        size = size.add(ex.vec(this.padding * 2, this.padding * 2));
      }
      return size ?? ex.vec(0, 0);
    }
    if (this._size == undefined) {
      this.calculateSize();
    }
    return this._size ?? ex.vec(0, 0);
  }

  set size(value: ex.Vector) {
    this._customSize = true;
    if (this._size?.x == value.x && this._size?.y == value.y) {
      return;
    }
    let oldSize = this._size?.clone() ?? ex.vec(0, 0);
    if (this._size == null) {
      this._size = ex.vec(value.x, value.y);
    } else {
      this._size.setTo(value.x, value.y);
    }
    if (value != null) {
      this.onResize(oldSize, this.size);
    }
    this.dirty = true;
  }

  getChild(name: string): Panel | null {
    return this.children.find((c) => c.name == name) as Panel;
  }

  _backgroundColor: ex.Color | null = null;
  get backgroundColor(): ex.Color | null {
    return this._backgroundColor;
  }
  set backgroundColor(value: ex.Color | null) {
    if (value == this._backgroundColor) {
      return;
    }
    this._backgroundColor = value;
    this.dirty = true;
  }

  _color: ex.Color = ex.Color.White;
  get color(): ex.Color {
    return this._color ?? ex.Color.White;
  }
  set color(value: ex.Color) {
    if (value == this._color) {
      return;
    }
    this._color = value;
    this.dirty = true;
  }

  get dirtyPanels(): DirtyPanels[] {
    let elements: DirtyPanels[] = [];
    for (let child of this.getChildrenPanels()) {
      if (child.dirty) {
        elements.push({ element: child, children: child.dirtyPanels });
      }
    }
    return elements;
  }

  get isChildDirty(): boolean {
    let children = this.getChildrenPanels();
    for (let child of children) {
      if (child.dirty) {
        return true;
      }
      if (child.isChildDirty) {
        return true;
      }
    }
    return false;
  }

  get innerWidth(): number {
    let leftPos: number | null = null;
    let rightPos: number | null = null;
    let children = this.getChildrenPanels();
    for (let child of children) {
      leftPos = leftPos ?? child.pos.x;
      if (child.pos.x < leftPos) {
        leftPos = child.pos.x;
      }
      rightPos = rightPos ?? child.width + child.pos.x;
      if (child.width + child.pos.x > rightPos) {
        rightPos = child.width + child.pos.x;
      }
    }
    if (leftPos == null || rightPos == null) {
      return 0;
    }
    return rightPos - leftPos;
  }

  _acceptingInputs?: boolean | ButtonStates[];
  get acceptingInputs(): boolean | ButtonStates[] {
    return this._acceptingInputs ?? true;
  }
  set acceptingInputs(value: boolean | ButtonStates[]) {
    this._acceptingInputs = value;
    InputManager.register(this);
  }

  get bounds(): ex.BoundingBox {
    const width = this.size?.x ?? 0;
    const height = this.size?.y ?? 0;
    const halfWidth = width / 2;
    const halfHeight = height / 2;
    return new ex.BoundingBox(
      this.pos.x - halfWidth,
      this.pos.y - halfHeight,
      this.pos.x + halfWidth,
      this.pos.y + halfHeight
    );
  }

  get globalBounds(): ex.BoundingBox {
    return new ex.BoundingBox(
      this.globalPos.x - this.halfWidth,
      this.globalPos.y - this.halfHeight,
      this.globalPos.x + this.halfWidth,
      this.globalPos.y + this.halfHeight
    );
  }

  _background: PanelBackgrounds | null = null;
  get background(): PanelBackgrounds | null {
    return this._background;
  }
  set background(value: PanelBackgrounds | null) {
    if (value == this._background) {
      return;
    }
    this._background = value;
    this.dirty = true;
  }

  constructor(parent?: Panel | null) {
    super();
    if (parent != null) {
      parent.addChild(this);
    }

    this.initializeGraphicsGroup();
  }

  calculateSize() {
    if (this._customSize) {
      return;
    }
    let oldSize = this._size?.clone() ?? ex.vec(0, 0);
    let children = this.getChildrenPanels();
    let topLeft: ex.Vector | null = null;
    let bottomRight: ex.Vector | null = null;
    for (let child of children) {
      child.calculateSize();
      let childBottomRight = child.bottomRight;
      bottomRight = bottomRight ?? childBottomRight;
      bottomRight.x = Math.min(bottomRight.x, childBottomRight.x);
      bottomRight.y = Math.min(bottomRight.y, childBottomRight.y);

      let childTopLeft = child.topLeft;
      topLeft = topLeft ?? childTopLeft;
      topLeft.x = Math.min(topLeft.x, childTopLeft.x);
      topLeft.y = Math.min(topLeft.y, childTopLeft.y);
    }
    if (this._size == undefined) {
      this._size = ex.vec(0, 0);
    }

    topLeft = topLeft ?? ex.vec(0, 0);
    bottomRight = bottomRight ?? ex.vec(0, 0);
    let newSize = bottomRight.sub(topLeft);

    if (oldSize.distance(newSize) != 0) {
      this._size = newSize;
      if (this.parent instanceof Panel) {
        this.parent.calculateSize();
      }
      this.emit("resize", { oldSize, newSize: this.size });
      this.dirty = true;
    }
  }

  getChildrenPanels(): Panel[] {
    return this.children.filter((c) => c instanceof Panel) as Panel[];
  }

  initializeGraphicsGroup() {
    if (this.graphicsGroup != null) {
      return;
    }

    this.graphicsGroup = new ex.GraphicsGroup({
      useAnchor: false,
      members: [],
    });
    this.graphics.use(this.graphicsGroup);
  }

  clearGraphics() {
    this.graphicsGroup.members = [];
  }
  addGraphic(graphic: ex.Graphic, offset?: ex.Vector) {
    offset =
      offset ??
      ex.vec(-this.size.x / 2 + this.padding, -this.size.y / 2 + this.padding);
    this.graphicsGroup.members.push({ graphic, offset });
  }

  collides(vec: ex.Vector): boolean {
    if (this.acceptingInputs === false) {
      return false;
    }

    if (!this.visible) {
      return false;
    }

    const bounds = this.globalBounds;
    if (bounds == null) {
      return false;
    }
    return bounds.contains(vec);
  }

  getPanel<T = Panel>(name: string): T | null {
    return this.children.find((c) => c.name == name) as T | null;
  }

  hasPanel(name: string): boolean {
    return this.children.some((c) => c.name == name);
  }

  addPanel<T extends Panel>(
    name: string,
    PanelClass: new (...args: any[]) => T,
    ...args: ConstructorParameters<typeof PanelClass>
  ): T {
    let existingChild = this.children.find((c) => c.name == name);

    if (existingChild != null) {
      return existingChild as T;
    }

    let element = new PanelClass(this, ...args);
    element.name = name;

    if (element.parent == null) {
      this.addChild(element);
      this.emit("childadded", element);
    }
    let subscription = element.on("resize", () => {
      this.calculateSize();
    });
    element.once("kill", () => {
      subscription.close();
    });

    this.calculateSize();
    return element;
  }

  removePanel(panel: string | Panel) {
    if (panel instanceof Panel) {
      panel = panel.name;
    }
    let child = this.children.find((c) => c.name == panel);
    if (child != null) {
      child.kill();
    }
  }
  removeAllPanels() {
    const children = this.getPanelChildren();
    for (let child of children) {
      if (child instanceof Panel) {
        child.kill();
      }
    }
  }

  getPanelChildren(): Panel[] {
    return this.children.filter((c) => c instanceof Panel) as Panel[];
  }

  onPointerLeave(e: ExtendedPointerEvent): void {
    if (!this.isHovered) {
      return;
    }
    this.isHovered = false;
    this.onHoverChanged(e);
  }

  onPointerEnter(e: ex.PointerEvent): void {
    if (this.isHovered) {
      return;
    }
    this.isHovered = true;
    this.onHoverChanged(e);
  }
  onPointerUp(_e: ex.PointerEvent): void { }
  onPointerDown(_e: ex.PointerEvent): void { }

  onHoverChanged(_e: ex.PointerEvent) { }

  getCurrentTick() {
    const engine = this.scene?.engine;
    if (engine == null) {
      return 0;
    }
    return engine.stats.currFrame.id;
  }

  renderChildren() {
    for (let i = 0; i < this.children.length; i++) {
      const child = this.children[i];
      if (child instanceof Panel) {
        child.render();
      }
    }
  }
  render() {
    if (!this.dirty) {
      this.renderChildren();
      return;
    }
    this.dirty = false;
    const tick = this.getCurrentTick();
    if (this.lastRenderTick == tick) {
      this.dirty = true;
    }
    this.lastRenderTick = tick;
    if (this._background != null) {
      let first: any = this.graphicsGroup.members?.[0];
      let newMembers = this.graphicsGroup.members;
      if (!(first?.graphic instanceof ex.NineSlice)) {
        newMembers.unshift({
          graphic: getNineslice({
            name: this._background,
            width: this.size.x,
            height: this.size.y,
          }),
          offset: ex.vec(-this.size.x / 2, -this.size.y / 2),
        });
      } else {
        newMembers[0] = {
          graphic: getNineslice({
            name: this._background,
            width: this.size.x,
            height: this.size.y,
          }),
          offset: ex.vec(-this.size.x / 2, -this.size.y / 2),
        };
      }

      this.graphicsGroup.members = newMembers;

      this.graphics.use(this.graphicsGroup);

      if (first?.graphic instanceof ex.NineSlice) {
        first.graphic.tint = this.backgroundColor ?? ex.Color.White;
      }

      this.graphics.use(this.graphicsGroup);
    }

    this.onRender();
    this.emit("render");

    this.renderChildren();

    if (this.visible === false) {
      this.graphics.opacity = 0;
    } else {
      this.graphics.opacity = 1;
    }

    let isFirst = true;

    for (const index in this.graphicsGroup.members) {
      let graphic = (this.graphicsGroup.members[index] as any).graphic;
      if (graphic == null) {
        continue;
      }
      if (this.background != null && isFirst) {
        graphic.tint = this.backgroundColor ?? ex.Color.White;
      } else {
        graphic.tint = this._color;
      }
      isFirst = false;
    }
    return;
  }

  onAdd(engine: ex.Engine): void {
    super.onAdd(engine);
    InputManager.register(this);
    const isParentPanel = this.parent instanceof Panel;
    if (!isParentPanel) {
      const subscription = this.scene?.engine.screen.events.on("resize", () => {
        this.calculateSize();
      });
      if (subscription != null) {
        this.subscriptions.push(subscription);
      }
    }
  }

  kill(): void {
    super.kill();
    for (let subscription of this.subscriptions) {
      subscription.close();
    }
  }

  onRender() { }

  getParent<T = Panel>(): T | null {
    let parent = this.parent;
    if (parent instanceof Panel) {
      return parent as T;
    }
    return null;
  }

  getParentBounds(): ex.BoundingBox {
    let parent = this.getParent();
    if (parent != null) {
      return parent.bounds;
    }

    return this.scene?.camera?.viewport ?? new ex.BoundingBox(0, 0, 0, 0);
  }

  isInBounds(position: ex.Vector) {
    const bounds = this.globalBounds;
    if (bounds == null) {
      return false;
    }
    return bounds.contains(position);
  }

  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    if (!(this.parent instanceof Panel)) {
      this.render();
    }
  }

  onResize(_oldSize: ex.Vector, _newSize: ex.Vector) { }
}
