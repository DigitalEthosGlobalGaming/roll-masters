import * as ex from "excalibur";
import { Panel } from "@src/ui/panel";
import { Label } from "./label";
import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";
import { ExtendedKeyEvent } from "@src/input/extended-key-event";
import { ButtonSurface } from "./button-surface";

const sliderColors = {
  edge: ex.Color.fromHex("#65583e"), focus: ex.Color.fromHex("#c9a66a"),
  well: ex.Color.fromHex("#101613"), fill: ex.Color.fromHex("#365b3f"),
  highlight: ex.Color.fromHex("#6b9362"), text: ex.Color.fromHex("#f2eadb"),
  disabled: ex.Color.fromHex("#34372f"), muted: ex.Color.fromHex("#858072"),
};

export class Slider extends Panel {
  private _value = 0;
  private _min = 0;
  private _max = 100;
  private _step = 1;
  private thumb: Label;
  private readonly trackEdge = new ex.Rectangle({ width: 1, height: 12, color: sliderColors.edge });
  private readonly trackWell = new ex.Rectangle({ width: 1, height: 8, color: sliderColors.well });
  private readonly fill = new ex.Rectangle({ width: 1, height: 6, color: sliderColors.fill });
  private readonly highlight = new ex.Rectangle({ width: 1, height: 2, color: sliderColors.highlight });
  private readonly handle = new ButtonSurface();
  private readonly edgeMember = this.addGraphic(this.trackEdge);
  private readonly wellMember = this.addGraphic(this.trackWell);
  private readonly fillMember = this.addGraphic(this.fill);
  private readonly highlightMember = this.addGraphic(this.highlight);
  private readonly handleMember = this.addGraphic(this.handle);
  private handleWidth = 48;
  private handleHeight = 44;
  onValueChanged: (oldValue: number, newValue: number) => void = () => {};
  constructor(parent: Panel) {
    super(parent);
    this.size = ex.vec(200, 48);
    this.background = null;
    this.focusable = true;
    this.acceptingInputs = ["MouseLeft"];
    this.accessibleName = "Slider";
    this.thumb = this.addPanel("thumb", Label);
    this.thumb.padding = 8;
    this.thumb.background = null;
    this.thumb.fontSize = 16;
    // Text sorts above the procedural face, just like Button's foreground label.
    this.thumb.z = 1;
  }
  get value(): number { return this._value; }
  set value(value: number) {
    if (!Number.isFinite(value)) return;
    const snapped = this.min + Math.round((value - this.min) / this.step) * this.step;
    const next = Math.max(this.min, Math.min(this.max, Number(snapped.toPrecision(12))));
    if (next === this._value) return;
    const previous = this._value;
    this._value = next;
    this.invalidate();
    this.onValueChanged(previous, next);
  }
  get min(): number { return this._min; }
  set min(value: number) {
    if (!Number.isFinite(value) || value === this._min) return;
    this._min = value;
    this._max = Math.max(value, this.max);
    this.value = this._value;
    this.invalidate();
  }
  get max(): number { return this._max; }
  set max(value: number) {
    if (!Number.isFinite(value) || value === this._max) return;
    this._max = Math.max(this.min, value);
    this.value = this._value;
    this.invalidate();
  }
  get step(): number { return this._step; }
  set step(value: number) { if (Number.isFinite(value) && value > 0 && value !== this._step) { this._step = value; this.value = this._value; this.invalidate(); } }
  get percentage(): number { return this.max === this.min ? 0 : (this.value - this.min) / (this.max - this.min); }
  set percentage(value: number) { if (Number.isFinite(value)) this.value = this.min + (this.max - this.min) * Math.max(0, Math.min(1, value)); }
  setValueFromPointerEvent(e: ExtendedPointerEvent): void {
    if (this.width <= 0) return;
    const local = this.transform.get().applyInverse(this.screenSpace ? e.screenPos : e.worldPos);
    this.percentage = (local.x - this.localBounds.left) / this.width;
  }
  override collides(world: ex.Vector): boolean {
    if (!this.rendered || this.disabled) return false;
    const local = this.transform.get().applyInverse(world);
    const extra = Math.max(12, this.handleWidth / 2 + 4);
    const halfHeight = Math.max(22, this.handleHeight / 2);
    return new ex.BoundingBox(-this.halfWidth - extra, -halfHeight, this.halfWidth + extra, halfHeight).contains(local);
  }
  override onPointerDown(e: ExtendedPointerEvent): void { super.onPointerDown(e); this.setValueFromPointerEvent(e); }
  onDragStart(e: ExtendedPointerEvent): void { this.setValueFromPointerEvent(e); }
  onDragMove(e: ExtendedPointerEvent): void { this.setValueFromPointerEvent(e); }
  onKeyDown(e: ExtendedKeyEvent): void {
    if (e.key === ex.Keys.Left || e.key === ex.Keys.Down) this.value -= this.step;
    if (e.key === ex.Keys.Right || e.key === ex.Keys.Up) this.value += this.step;
    if (e.key === ex.Keys.Home) this.value = this.min;
    if (e.key === ex.Keys.End) this.value = this.max;
  }
  override onRefresh(): void { this.thumb.text = String(this.value); }
  override onLayout(): void {
    this.thumb.pos = ex.vec(this.percentage * this.width - this.halfWidth, 0);
    this.handleWidth = Math.max(44, this.thumb.width + 12);
    this.handleHeight = Math.max(44, this.thumb.height + 8);
  }
  override onRender(): void {
    const width = Math.max(0, this.width), innerWidth = Math.max(0, width - 4);
    this.trackEdge.width = width;
    this.trackEdge.color = this.disabled ? sliderColors.muted : this.focused || this.isHovered || this.isMouseDown ? sliderColors.focus : sliderColors.edge;
    this.trackWell.width = innerWidth;
    this.fill.width = this.highlight.width = innerWidth * this.percentage;
    this.fill.color = this.disabled ? sliderColors.disabled : sliderColors.fill;
    this.highlight.color = this.disabled ? sliderColors.muted : sliderColors.highlight;
    this.edgeMember.offset = ex.vec(-width / 2, -6);
    this.wellMember.offset = ex.vec(-width / 2 + 2, -4);
    this.fillMember.offset = ex.vec(-width / 2 + 2, -3);
    this.highlightMember.offset = ex.vec(-width / 2 + 2, -3);
    this.handle.width = this.handleWidth; this.handle.height = this.handleHeight;
    this.handle.state = this.disabled ? "disabled" : this.isMouseDown ? "pressed" : this.isHovered || this.focused ? "hover" : "normal";
    this.handle.disabled = this.disabled; this.handle.focused = this.focused;
    this.handleMember.offset = ex.vec(this.thumb.pos.x - this.handleWidth / 2, -this.handleHeight / 2);
    this.thumb.color = this.disabled ? sliderColors.muted : sliderColors.text;
  }
}
