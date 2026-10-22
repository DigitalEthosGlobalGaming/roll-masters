import * as ex from "excalibur";
import { Panel } from "@src/ui/panel";
import { theme } from "../theme";
import { Resources } from "@src/resources";
import { Environment } from "@src/env";

// Keep currency markers in source strings; render them as inline artwork.
const moneyMarker = "\u23e2";
const moneySpace = "\u2003";

export class Label extends Panel {
  private graphic: ex.Text;
  private textMember: { graphic: ex.Graphic; offset: ex.Vector };
  private _text = "";
  private _fontSize = theme.fontSize;
  private _fontFamily = theme.fontFamily;
  private readonly font = new ex.Font({ family: this._fontFamily, size: this._fontSize, baseAlign: ex.BaseAlign.Middle, textAlign: ex.TextAlign.Center });
  private _align: "left" | "center" | "right" = "center";
  private _maxWidth = Infinity;
  private displayText = "";
  private textSize = ex.vec(0, 0);
  private textDirty = true;
  private _drawOffset = ex.vec(0, 0);
  /** Translate all label artwork without moving layout or hit bounds. */
  get drawOffset(): ex.Vector { return this._drawOffset; }
  set drawOffset(value: ex.Vector) {
    if (value.equals(this._drawOffset)) return;
    this._drawOffset = value.clone();
    this.invalidatePaint();
  }
  private moneyIcons: { graphic: ex.Sprite; offset: ex.Vector }[] = [];
  constructor(parent: Panel | null = null, text = "") {
    super(parent);
    this.graphic = new ex.Text({ text: "", font: this.font });
    this.textMember = this.addGraphic(this.graphic);
    this.text = text;
  }
  get text(): string { return this._text; }
  set text(value: string) { value = value ?? ""; if (value !== this._text) { this._text = value; this.invalidateText(); } }
  get fontFamily(): string { return this._fontFamily; }
  set fontFamily(value: string) { if (value && value !== this._fontFamily) { this._fontFamily = value; this.font.family = value; this.invalidateText(); } }
  get fontSize(): number { return this._fontSize * (Environment.get("large-text") ? 1.2 : 1); }
  set fontSize(value: number) { value = Math.max(1, Number.isFinite(value) ? value : 20); if (value !== this._fontSize) { this._fontSize = value; this.invalidateText(); } }
  get align(): "left" | "center" | "right" { return this._align; }
  set align(value: "left" | "center" | "right") { if (value !== this._align) { this._align = value; this.invalidatePaint(); } }
  get maxWidth(): number { return this._maxWidth; }
  set maxWidth(value: number) { value = Math.max(1, value); if (value !== this._maxWidth) { this._maxWidth = value; this.invalidateText(); } }
  private invalidateText() { this.textDirty = true; this.invalidateLayout(); }
  override invalidate() { this.textDirty = true; super.invalidate(); }
  private measureWidth(text: string): number {
    // Excalibur measures ink bounds, which omit trailing whitespace. A visible
    // sentinel preserves the inline icon's reserved space, including at line ends.
    return this.font.measureText(text + "M").width - this.font.measureText("M").width;
  }
  private measureText() {
    if (!this.textDirty) return;
    this.textDirty = false;
    const font = this.font;
    font.size = this.fontSize;
    font.lineHeight = this.fontSize * 1.2;
    const lines: string[] = [];
    for (const line of this.text.replaceAll(moneyMarker, moneySpace).split("\n")) {
      let current = "";
      for (const char of line) {
        if (current && this.measureWidth(current + char) > this.maxWidth) { lines.push(current); current = ""; }
        current += char;
      }
      lines.push(current);
    }
    this.displayText = lines.join("\n");
    this.graphic.text = this.displayText;
    const width = Math.max(0, ...lines.map(line => this.measureWidth(line)));
    this.textSize = ex.vec(width, this.text ? lines.length * this.fontSize * 1.2 : 0);
  }
  protected override measure(): ex.BoundingBox {
    this.measureText();
    return this.centeredSize(this.textSize.x + this.padding * 2, this.textSize.y + this.padding * 2);
  }
  adjustFontsizeToWidth(width: number) {
    if (!this.text || !Number.isFinite(width) || width <= 0) return;
    let low = 1, high = 128;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      this.font.size = mid * (Environment.get("large-text") ? 1.2 : 1);
      if (Math.max(...this.text.replaceAll(moneyMarker, moneySpace).split("\n").map(line => this.measureWidth(line))) <= width) low = mid; else high = mid - 1;
    }
    this.fontSize = low;
    this.font.size = this.fontSize;
  }
  override onRender(): void {
    this.measureText();
    this.graphic.color = this.color;
    this.font.textAlign = this.align === "left" ? ex.TextAlign.Left : this.align === "right" ? ex.TextAlign.Right : ex.TextAlign.Center;
    // Graphics offsets are retained and updated only when painting changes.
    const x = (this.align === "left" ? -this.textSize.x / 2 : this.align === "right" ? this.textSize.x / 2 : 0) + this._drawOffset.x;
    this.textMember.offset = ex.vec(x, -this.textSize.y / 2 + this.fontSize * 0.6 + this._drawOffset.y);
    let iconIndex = 0;
    const reservedWidth = this.measureWidth(moneySpace);
    const iconSize = Math.min(this.fontSize, reservedWidth) * 0.9;
    for (const [row, line] of this.displayText.split("\n").entries()) {
      const lineWidth = this.measureWidth(line);
      const lineLeft = x - (this.align === "left" ? 0 : this.align === "right" ? lineWidth : lineWidth / 2);
      for (let index = 0; index < line.length; index++) {
        if (line[index] !== moneySpace) continue;
        let member = this.moneyIcons[iconIndex++];
        if (!member) {
          const sprite = ex.Sprite.from(Resources.Dollar);
          member = this.addGraphic(sprite) as { graphic: ex.Sprite; offset: ex.Vector };
          this.moneyIcons.push(member);
        }
        member.graphic.destSize = { width: iconSize, height: iconSize };
        member.offset = ex.vec(
          lineLeft + this.measureWidth(line.slice(0, index)) + (reservedWidth - iconSize) / 2,
          this.textMember.offset.y + row * this.fontSize * 1.2 - iconSize / 2
        );
      }
    }
    for (const member of this.moneyIcons.splice(iconIndex)) this.removeGraphic(member.graphic);
  }
}
