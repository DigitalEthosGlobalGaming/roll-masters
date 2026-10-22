import * as ex from "excalibur";
import { Panel } from "./panel";
import { Label } from "./elements/label";

export interface InformationEntry { title: string; body: string }

/** A complete, readable credit or release-note entry is kept on one page. */
export class InformationCard extends Panel {
  private title!: Label;
  private description!: Label;
  private availableWidth = 560;
  private surface = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#1e2522") });
  private edge = new ex.Rectangle({ width: 3, height: 1, color: ex.Color.fromHex("#65583e") });
  private surfaceMember = this.addGraphic(this.surface);
  private edgeMember = this.addGraphic(this.edge);
  constructor(parent: Panel, readonly entry: InformationEntry) { super(parent); }
  setLayoutWidth(width: number): void {
    width = Math.max(1, width);
    if (width !== this.availableWidth) { this.availableWidth = width; this.invalidateLayout(); }
  }
  override onSetup(): void {
    this.title = this.addPanel("title", Label); this.title.text = this.entry.title;
    this.title.fontSize = 20; this.title.color = ex.Color.fromHex("#e5c58a");
    this.description = this.addPanel("body", Label); this.description.text = this.entry.body;
    this.description.fontSize = 17; this.description.color = ex.Color.fromHex("#f2eadb");
    for (const label of [this.title, this.description]) { label.align = "left"; label.z = 1; }
  }
  override onLayout(): void {
    const padding = this.screenHeight < 450 ? 12 : 16;
    this.title.maxWidth = this.description.maxWidth = Math.max(1, this.availableWidth - padding * 2);
    this.size = ex.vec(this.availableWidth, padding * 2 + this.title.height + 8 + this.description.height);
    this.title.topLeft = ex.vec(-this.halfWidth + padding, -this.halfHeight + padding);
    this.description.topLeft = ex.vec(this.title.left, this.title.bottom + 8);
  }
  override onRender(): void {
    this.surface.width = this.width; this.surface.height = this.edge.height = this.height;
    this.surfaceMember.offset = this.edgeMember.offset = ex.vec(-this.halfWidth, -this.halfHeight);
  }
}
