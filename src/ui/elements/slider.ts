import * as ex from "excalibur";
import { Panel, PanelBackgrounds } from "@src/ui/panel";
import { Label } from "./label";
import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";
import { ExtendedKeyEvent } from "@src/input/extended-key-event";

export class Slider extends Panel {
  private _value = 0;
  private _min = 0;
  private _max = 100;
  private _step = 1;
  private thumb: Label;
  onValueChanged: (oldValue: number, newValue: number) => void = () => {};
  constructor(parent: Panel) {
    super(parent);
    this.size = ex.vec(200, 12);
    this.background = PanelBackgrounds.Button;
    this.focusable = true;
    this.acceptingInputs = ["MouseLeft"];
    this.accessibleName = "Slider";
    this.thumb = this.addPanel("thumb", Label);
    this.thumb.padding = 8;
    this.thumb.background = PanelBackgrounds.Button;
    this.thumb.fontSize = 16;
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
    return new ex.BoundingBox(-this.halfWidth - 12, -22, this.halfWidth + 12, 22).contains(local);
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
  override onLayout(): void { this.thumb.pos = ex.vec(this.percentage * this.width - this.halfWidth, 0); }
  override onRender(): void { this.thumb.backgroundColor = this.focused ? ex.Color.ExcaliburBlue : ex.Color.White; }
}
