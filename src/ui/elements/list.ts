import * as ex from "excalibur";
import { Panel } from "@src/ui/panel";

/** Vertical stack. Hidden children retain space; collapsed children do not. */
export class List extends Panel {
  private _spacing = 0;
  get spacing(): number { return this._spacing; }
  set spacing(value: number) { value = Math.max(0, Number.isFinite(value) ? value : 0); if (value !== this._spacing) { this._spacing = value; this.invalidateLayout(); } }
  get totalHeight(): number {
    const children = this.getChildrenPanels().filter(child => !child.collapsed);
    return children.reduce((sum, child) => sum + child.height, 0) + Math.max(0, children.length - 1) * this.spacing;
  }
  protected override measure(): ex.BoundingBox {
    const children = this.getChildrenPanels().filter(child => !child.collapsed);
    const width = Math.max(0, ...children.map(child => child.width));
    return this.centeredSize(width + this.padding * 2, this.totalHeight + this.padding * 2);
  }
  override onLayout(): void {
    let y = -this.totalHeight / 2;
    for (const child of this.getChildrenPanels()) {
      if (child.collapsed) continue;
      // Child placement does not change this stack's measured size.
      child.pos = ex.vec(-child.localBounds.center.x, y - child.localBounds.top);
      y += child.height + this.spacing;
    }
  }
  updatePositions(): void { this.invalidateLayout(); }
}
