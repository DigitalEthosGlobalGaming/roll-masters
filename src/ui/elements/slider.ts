import * as ex from "excalibur";
import { Panel } from "@src/ui/panel";
import { Button } from "./button";
import { getNineslice } from "@src/resources";
import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";

export class SliderButton extends Button {
  isDragging = false;
  onPointerDown(e: ExtendedPointerEvent): void {
    super.onPointerDown(e);
    this.isDragging = true;
  }
  onPointerUp(e: ExtendedPointerEvent): void {
    super.onPointerDown(e);
    this.isDragging = false;
  }
}

export class Slider extends Panel {
  _button: Button | null = null;

  sliderGraphic: ex.Graphic | null = null;

  protected _value = 0;
  protected _min = 0;
  protected _max = 100;
  protected _step = 1;

  get value(): number {
    return this._value;
  }
  set value(value: number) {
    value = Math.max(this.min, value);
    value = Math.min(this.max, value);

    if (value == this._value) {
      return;
    }

    let previous = this._value;
    this._value = value;
    this.onValueChanged?.(previous, value);
    this.dirty = true;
  }
  get min(): number {
    return this._min;
  }
  set min(value: number) {
    if (value == this._min) {
      return;
    }
    this._min = value;
    this.value = Math.max(this.value, this.min);
    this.dirty = true;
  }
  get max(): number {
    return this._max;
  }
  set max(value: number) {
    if (value == this._max) {
      return;
    }
    this._max = value;
    this.value = Math.min(this.value, this.max);
    this.dirty = true;
  }

  get percentage(): number {
    return (this.value - this.min) / (this.max - this.min);
  }
  set percentage(value: number) {
    this.value = this.min + (this.max - this.min) * value;
  }
  get step(): number {
    return this._step;
  }
  set step(value: number) {
    if (value == this._step) {
      return;
    }
    this._step = value;
    this.dirty = true;
  }

  get size(): ex.Vector {
    const superSize = super.size;
    if (this._customSize != null) {
      return super.size;
    }

    return ex.vec(superSize.x, 10);
  }
  set size(value: ex.Vector) {
    super.size = value;
  }

  onValueChanged: (oldValue: number, newValue: number) => void = () => { };


  onDragMove(e: ExtendedPointerEvent): void {
    this.setValueFromPointerEvent(e);
  }

  onPointerPressed(e: ExtendedPointerEvent): void {
    this.setValueFromPointerEvent(e);
  }
  setValueFromPointerEvent(e: ExtendedPointerEvent): void {
    const mouseX = e.worldPos.x;
    const size = this.size.x;
    const worldX = this.globalPos.x;
    const localX = mouseX - worldX;
    const percentage = (localX / size) + 0.5;
    const range = this.max - this.min;
    const stepCount = range / this.step;
    const stepSize = 1 / stepCount;
    const steppedPercentage = Math.round(percentage / stepSize) * stepSize;
    this.value = this.min + steppedPercentage * range;
  }


  setGraphic() {
    if (this.sliderGraphic != null) {
      return;
    }
    const size = this.size;
    const sliderGraphic = {
      graphic: getNineslice({
        name: "Button",
        width: size.x,
        height: size.y,
      }),
      offset: ex.vec(-size.x / 2, -size.y / 2),
    }
    this.addGraphic(sliderGraphic.graphic, sliderGraphic.offset);

  }

  render(): void {
    this.setGraphic();
    super.render();
  }

  onRender(): void {
    super.onRender();
    const button = this.addPanel("button", Button);
    button.text = (Math.round(this.value * 100) / 100).toString();
    button.fontSize = 14;
    button.onPointerDown
    const width = this.size.x;
    const offset = this.percentage * width - width / 2;
    button.pos = ex.vec(offset, 0);
  }
}
