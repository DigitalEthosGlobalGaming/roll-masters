import * as ex from "excalibur";
import { Panel } from "./panel";
import { Label } from "./elements/label";
import { Environment } from "@src/env";
import { SoundManager } from "@src/sound-manager";

const palette = {
  card: ex.Color.fromHex("#1e2522"), edge: ex.Color.fromHex("#65583e"),
  control: ex.Color.fromHex("#29302c"), selected: ex.Color.fromHex("#36523a"),
  brass: ex.Color.fromHex("#c9a66a"), text: ex.Color.fromHex("#f2eadb"), muted: ex.Color.fromHex("#b5b9ae"),
};
const options = [
  { key: "sound", section: "AUDIO", title: "Sound", description: "Choose what you hear while playing.", values: ["Music + effects", "Effects only", "Muted"] },
  { key: "graphics", section: "DISPLAY", title: "Graphics", description: "Basic reduces dice and piece animation.", values: ["Advanced", "Basic"] },
  { key: "reduced-motion", section: "ACCESSIBILITY", title: "Reduce motion", description: "Limit movement without changing production.", values: ["Follow system", "On"] },
  { key: "hide-floating-gold", section: "EFFECTS", title: "Flying gold", description: "Show gold travelling from dice to your total.", values: ["On", "Off"] },
];
type SettingOption = typeof options[number];

/** Quiet settings control: explicit choice, fixed hit area, authored text above the face. */
export class SettingsChoice extends Panel {
  private label: Label;
  private face = new ex.Rectangle({ width: 1, height: 1, color: palette.control });
  private edge = new ex.Rectangle({ width: 1, height: 2, color: palette.edge });
  private flash = new ex.Rectangle({ width: 1, height: 1, color: palette.brass, opacity: 0 });
  private faceMember = this.addGraphic(this.face);
  private edgeMember = this.addGraphic(this.edge);
  private flashMember = this.addGraphic(this.flash);
  private focusLines = Array.from({ length: 3 }, () => ({
    graphic: new ex.Rectangle({ width: 1, height: 1, color: palette.text, opacity: 0 }), offset: ex.vec(0, 0),
  }));
  private remaining = 0;
  private _caption: string;
  set caption(value: string) { if (value !== this._caption) { this._caption = value; this.invalidate(); } }
  private _selected = false;
  get selected(): boolean { return this._selected; }
  set selected(value: boolean) { if (value !== this._selected) { this._selected = value; this.invalidate(); } }
  onChoose: () => void = () => {};
  constructor(parent: Panel, readonly title: string) {
    super(parent);
    this._caption = title;
    this.accessibleName = title; this.focusable = true; this.acceptingInputs = ["MouseLeft"]; this.z = 1;
    this.label = this.addPanel("label", Label); this.label.z = 1; this.label.fontSize = 16;
    for (const line of this.focusLines) this.addGraphic(line.graphic, line.offset);
    this.size = ex.vec(140, 48);
  }
  activate(): void {
    if (!this.rendered || this.disabled || this.selected) return;
    this.onChoose();
    SoundManager.play("ChipLay2");
    this.remaining = Environment.get("reduced-motion") || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : 100;
    this.invalidatePaint();
  }
  onPointerPressed(): void { this.activate(); }
  override onRefresh(): void {
    this.label.text = this.selected ? `\u2713 ${this._caption}` : this._caption;
  }
  override onLayout(): void { this.label.maxWidth = Math.max(1, this.width - 20); }
  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    if (!this.remaining) return;
    this.remaining = Environment.get("reduced-motion") || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? 0 : Math.max(0, this.remaining - elapsed);
    this.invalidatePaint();
  }
  override onRender(): void {
    this.face.width = this.width; this.face.height = this.height;
    this.face.color = this.isMouseDown || this.selected ? palette.selected : palette.control;
    this.edge.width = this.width; this.edge.height = this.focused ? 3 : 2;
    this.edge.color = this.focused || this.selected || this.isHovered ? palette.brass : palette.edge;
    this.flash.width = this.width; this.flash.height = this.height;
    this.flash.opacity = 0.12 * Math.pow(this.remaining / 100, 2);
    const frames = [[-this.halfWidth, -this.halfHeight, this.width, 2], [-this.halfWidth, -this.halfHeight, 2, this.height], [this.halfWidth - 2, -this.halfHeight, 2, this.height]];
    this.focusLines.forEach((line, index) => {
      const [x, y, width, height] = frames[index];
      line.graphic.width = width; line.graphic.height = height; line.graphic.opacity = this.focused ? 1 : 0;
      line.offset.x = x; line.offset.y = y;
    });
    this.faceMember.offset = this.flashMember.offset = ex.vec(-this.halfWidth, -this.halfHeight);
    this.edgeMember.offset = ex.vec(-this.halfWidth, this.halfHeight - this.edge.height);
    this.label.color = palette.text;
  }
}

/** A complete paging unit: its description and all choices always travel together. */
export class SettingsRow extends Panel {
  private section!: Label;
  private title!: Label;
  private description!: Label;
  private status!: Label;
  private choices: SettingsChoice[] = [];
  private availableWidth = 560;
  private media?: MediaQueryList;
  private surface = new ex.Rectangle({ width: 1, height: 1, color: palette.card });
  private surfaceMember = this.addGraphic(this.surface);
  constructor(parent: Panel, readonly option: SettingOption) { super(parent); }
  setLayoutWidth(width: number): void {
    width = Math.max(1, width);
    if (width !== this.availableWidth) { this.availableWidth = width; this.invalidateLayout(); }
  }
  override onSetup(): void {
    this.section = this.addPanel("section", Label); this.section.fontSize = 12; this.section.color = palette.brass;
    this.section.text = this.option.section;
    this.title = this.addPanel("title", Label); this.title.fontSize = 21; this.title.text = this.option.title;
    this.description = this.addPanel("description", Label); this.description.fontSize = 15; this.description.color = palette.muted;
    this.description.text = this.option.description;
    this.status = this.addPanel("status", Label); this.status.fontSize = 14; this.status.color = palette.muted;
    for (const label of [this.section, this.title, this.description, this.status]) { label.align = "left"; label.z = 1; }
    this.choices = this.option.values.map((title, index) => {
      const choice = this.addPanel(`choice-${index}`, SettingsChoice, title);
      choice.onChoose = () => {
        Environment.set(this.option.key, index);
        if (this.option.key === "sound") SoundManager.instance?.applySettings();
        let root = this.parentPanel;
        if (!root) return;
        while (root.parentPanel) root = root.parentPanel;
        root.allDirty = true;
      };
      return choice;
    });
    if (this.option.key === "reduced-motion") {
      this.media = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
      const changed = () => this.invalidate();
      this.media?.addEventListener?.("change", changed);
      this.subscriptions.push({ close: () => this.media?.removeEventListener?.("change", changed) });
    }
  }
  override onRefresh(): void {
    const stored = Number(Environment.get(this.option.key, 0));
    const value = Number.isInteger(stored) && stored >= 0 && stored < this.choices.length ? stored : 0;
    this.choices.forEach((choice, index) => {
      choice.selected = index === value;
      choice.accessibleName = `${this.option.title}: ${choice.title}`;
    });
    this.status.text = this.option.key === "reduced-motion" ? `Currently ${value || this.media?.matches ? "reduced" : "full"} motion` : "";
    if (this.option.key === "hide-floating-gold" && (Environment.get("reduced-motion") || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches)) {
      this.status.text = "Hidden while reduced motion is active.";
    }
    this.status.collapsed = !this.status.text;
  }
  override onLayout(): void {
    const width = this.availableWidth;
    const padding = 14, gap = 8;
    const compact = this.screenHeight > 0 && this.screenHeight < 450;
    this.choices.forEach((choice, index) => {
      choice.caption = compact && this.option.key === "sound" ? ["All audio", "Effects", "Muted"][index] : choice.title;
    });
    this.section.collapsed = compact;
    const wide = width >= 600 || compact && width >= 460;
    const textFraction = compact ? 0.5 : 0.4;
    const textWidth = wide ? width * textFraction - padding * 2 : width - padding * 2;
    for (const label of [this.section, this.title, this.description, this.status]) label.maxWidth = Math.max(1, textWidth);
    const left = -width / 2 + padding;
    // Calculate coordinates before committing the explicit card size.
    const textHeight = (this.section.collapsed ? 0 : this.section.height + 6) + this.title.height + 6 + this.description.height + (this.status.collapsed ? 0 : 6 + this.status.height);
    const controlWidth = wide ? width * (1 - textFraction) - padding - gap : width - padding * 2;
    const columns = wide || (controlWidth / this.choices.length >= 132) ? this.choices.length : this.choices.length === 2 ? 2 : 1;
    const slot = (controlWidth - gap * (columns - 1)) / columns;
    const heights = this.choices.map(choice => {
      const label = choice.getPanel<Label>("label")!;
      label.maxWidth = Math.max(1, slot - 20);
      return Math.max(48, label.height + 20);
    });
    const rowHeight = Math.max(...heights);
    for (const choice of this.choices) choice.size = ex.vec(slot, rowHeight);
    const controlsHeight = Math.ceil(this.choices.length / columns) * (rowHeight + gap) - gap;
    const height = padding * 2 + (wide ? Math.max(textHeight, controlsHeight) : textHeight + 16 + controlsHeight);
    this.size = ex.vec(width, height);
    let y = -height / 2 + padding;
    for (const label of [this.section, this.title, this.description, this.status]) {
      if (label.collapsed) continue;
      label.topLeft = ex.vec(left, y); y += label.height + 6;
    }
    const controlsLeft = wide ? width / 2 - padding - controlWidth : left;
    const controlsTop = wide ? -controlsHeight / 2 : -height / 2 + padding + textHeight + 16;
    this.choices.forEach((choice, index) => {
      choice.topLeft = ex.vec(controlsLeft + index % columns * (slot + gap), controlsTop + Math.floor(index / columns) * (rowHeight + gap));
    });
  }
  override onRender(): void {
    this.surface.width = this.width; this.surface.height = this.height;
    this.surfaceMember.offset = ex.vec(-this.halfWidth, -this.halfHeight);
  }
}

export function addSettingsContent(parent: Panel): void {
  for (const option of options) parent.addPanel(option.key, SettingsRow, option);
}
