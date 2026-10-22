import * as ex from "excalibur";
import { Panel } from "@src/ui/panel";
import type { Tooltip } from "@src/player-systems/player-tooltip";
import { Label } from "./label";
import { SoundManager } from "@src/sound-manager";
import type { SoundKey } from "@src/resources";
import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";
import { theme } from "../theme";
import { ButtonSurface } from "./button-surface";
import { Environment } from "@src/env";

export type ButtonIcon = { imageSource: ex.ImageSource; width: number; height: number };
export class Button extends Panel {
  protected label: Label;
  private _icon?: ButtonIcon;
  private sprite?: ex.Sprite;
  private iconMember?: { graphic: ex.Graphic; offset: ex.Vector };
  private iconDirty = false;
  private _iconPlacement: "beside" | "above" = "beside";
  get iconPlacement(): "beside" | "above" { return this._iconPlacement; }
  set iconPlacement(value: "beside" | "above") {
    if (value === this._iconPlacement) return;
    this._iconPlacement = value;
    this.invalidateLayout();
  }
  private _tooltip?: Tooltip;
  private activationPressed = false;
  private get quietMotion(): boolean { return !!Environment.get("reduced-motion") || (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false); }
  sound: SoundKey = "ChipLay2";
  private _quiet = false;
  get quiet(): boolean { return this._quiet; }
  set quiet(value: boolean) { if (value !== this._quiet) { this._quiet = value; this.invalidatePaint(); } }
  private _selected = false;
  get selected(): boolean { return this._selected; }
  set selected(value: boolean) { if (value !== this._selected) { this._selected = value; this.invalidatePaint(); } }
  private readonly surface = new ButtonSurface();
  private readonly surfaceMember: { graphic: ex.Graphic; offset: ex.Vector };
  onClick: (e?: ExtendedPointerEvent) => void = () => {};
  constructor(parent: Panel) {
    super(parent);
    this.focusable = true;
    this.z = 1;
    this.background = null;
    this.acceptingInputs = ["MouseLeft"];
    this.padding = theme.padding;
    this.surfaceMember = this.addGraphic(this.surface);
    this.label = this.addPanel("label", Label);
    // Text must sort above its parent's background, including equal-depth screen UI batches.
    this.label.z = 1;
  }
  get text(): string { return this.label.text; }
  set text(value: string | undefined | null) { this.label.text = value ?? ""; this.accessibleName = this.label.text || this._tooltip?.title || "Button"; }
  get fontSize(): number { return this.label.fontSize; }
  set fontSize(value: number) { this.label.fontSize = value; }
  set maxTextWidth(value: number) { this.label.maxWidth = value; }
  get icon(): ButtonIcon | undefined { return this._icon; }
  set icon(value: ButtonIcon | undefined) {
    if (value?.imageSource === this._icon?.imageSource && value?.width === this._icon?.width && value?.height === this._icon?.height) return;
    this._icon = value;
    this.iconDirty = true;
    this.invalidateLayout();
  }
  get tooltip(): Tooltip | undefined { return this._tooltip; }
  set tooltip(value: Tooltip | string | undefined) {
    const next = typeof value === "string" ? { code: `button-${this.id}`, title: value, description: "" } : value;
    if (next?.code === this._tooltip?.code && next?.title === this._tooltip?.title && next?.description === this._tooltip?.description) return;
    if (this._tooltip && this.tooltipShown) this.getService("hideTooltip")?.(this._tooltip);
    this._tooltip = next;
    this.accessibleName = this.text || next?.title || "Button";
    this.tooltipShown = false;
    this.updateTooltipVisibility();
    this.invalidatePaint();
  }
  protected override measure(): ex.BoundingBox {
    if (this.icon && this.iconPlacement === "above") {
      return this.centeredSize(Math.max(44, this.label.width + 16, this.icon.width + 16),
        this.icon.height + (this.text ? this.label.height + 4 : 0) + 16);
    }
    const gap = this.icon && this.text ? theme.gap : 0;
    const framePadding = 24;
    return this.centeredSize(Math.max(theme.targetSize + this.padding * 2, this.label.width + (this.icon?.width ?? 0) + gap + framePadding * 2),
      Math.max(theme.targetSize, this.label.height, this.icon?.height ?? 0) + this.padding * 2);
  }
  override onLayout(): void {
    this.label.pos = this.icon && this.iconPlacement === "above"
      ? ex.vec(0, (this.icon.height + 4) / 2)
      : ex.vec(this.icon ? -(this.icon.width + (this.text ? theme.gap : 0)) / 2 : 0, 0);
  }
  activate(e?: ExtendedPointerEvent): void {
    if (!this.rendered || this.disabled) return;
    if (!this.quietMotion) this.surface.pulse();
    this.invalidatePaint();
    SoundManager.play(this.sound);
    this.emit("button-clicked", e);
    this.onClick(e);
  }
  onPointerPressed(e: ExtendedPointerEvent): void { this.activate(e); }
  private tooltipShown = false;
  private updateTooltipVisibility(): void {
    const show = (this.isHovered || this.focused) && this.rendered && !this.disabled;
    if (show === this.tooltipShown || !this._tooltip) return;
    this.tooltipShown = show;
    this.getService(show ? "showTooltip" : "hideTooltip")?.(this._tooltip);
  }
  override onHoverChanged(e: ExtendedPointerEvent): void { super.onHoverChanged(e); this.updateTooltipVisibility(); }
  override onFocusChanged(value: boolean): void { super.onFocusChanged(value); if (!value) this.activationPressed = false; this.updateTooltipVisibility(); }
  override onRemove(engine: ex.Engine): void {
    if (this._tooltip && this.tooltipShown) this.getService("hideTooltip")?.(this._tooltip);
    this.tooltipShown = false;
    super.onRemove(engine);
  }
  override kill(): void {
    if (this._tooltip && this.tooltipShown) this.getService("hideTooltip")?.(this._tooltip);
    this.tooltipShown = false;
    super.kill();
  }
  onActivationKeyChanged(pressed: boolean): void {
    this.activationPressed = pressed; this.invalidatePaint();
  }
  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    const active = this.rendered && !this.disabled;
    if (!active) this.activationPressed = false;
    if (this.surface.updateMotion(active && (this.isMouseDown || this.activationPressed), !active || this.quietMotion, elapsed)) this.invalidatePaint();
    super.onPreUpdate(engine, elapsed);
  }
  override onRender(): void {
    this.updateTooltipVisibility();
    if (this.disabled || this.quietMotion) this.surface.updateMotion(false, true, 0);
    this.surface.state = this.disabled ? "disabled" : this.isMouseDown || this.activationPressed ? "pressed" : this.isHovered || this.focused ? "hover" : "normal";
    this.surface.width = this.width;
    this.surface.height = this.height;
    this.surface.disabled = this.disabled;
    this.surface.focused = this.focused;
    this.surface.selected = this.selected;
    this.surface.quiet = this.quiet;
    this.surfaceMember.offset = ex.vec(-this.halfWidth, -this.halfHeight);
    const offset = this.surface.contentOffset;
    this.label.drawOffset = ex.vec(0, offset);
    this.label.color = this.disabled ? theme.muted : this.color;
    if (this.iconDirty) {
      this.iconDirty = false;
      if (this.sprite) this.removeGraphic(this.sprite);
      this.sprite = this.icon ? ex.Sprite.from(this.icon.imageSource) : undefined;
      this.iconMember = undefined;
      if (this.sprite && this.icon) {
        this.sprite.destSize = { width: this.icon.width, height: this.icon.height };
        this.iconMember = this.addGraphic(this.sprite);
      }
    }
    if (this.sprite && this.icon && this.iconMember) {
      this.sprite.tint = this.disabled ? theme.muted : this.color;
      this.iconMember.offset = this.iconPlacement === "above"
        ? ex.vec(-this.icon.width / 2, -(this.icon.height + (this.text ? this.label.height + 4 : 0)) / 2 + offset)
        : ex.vec((this.text ? this.label.width + theme.gap : 0) / 2 - this.icon.width / 2, -this.icon.height / 2 + offset);
    }
  }
}
