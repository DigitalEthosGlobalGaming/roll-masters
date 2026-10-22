import * as ex from "excalibur";
import { Panel } from "./panel";
import { Button } from "./elements/button";
import { List } from "./elements/list";

/** Bounded, paged vertical content. Full rows stay inside the viewport, including hit targets. */
export class ScrollPanel extends Panel {
  readonly content: List;
  private previous: Button;
  private next: Button;
  private start = 0;
  private end = 0;
  private pageStarts = [0];
  private footerNavigation = false;
  constructor(parent: Panel) {
    super(parent);
    this.content = this.addPanel("content", List);
    this.content.spacing = 12;
    this.previous = this.addPanel("previous", Button);
    this.previous.text = "Previous";
    this.previous.onClick = () => {
      const page = this.pageStarts.indexOf(this.start);
      this.start = this.pageStarts[Math.max(0, page - 1)];
      this.invalidateLayout();
    };
    this.next = this.addPanel("next", Button);
    this.next.text = "More";
    this.next.onClick = () => { this.start = this.end; this.invalidateLayout(); };
  }
  /** Settings share their persistent Back footer with compact paging arrows. */
  useFooterNavigation(): void {
    this.footerNavigation = true;
    this.previous.text = "\u2039"; this.next.text = "\u203a";
    this.previous.accessibleName = "Previous settings page"; this.next.accessibleName = "Next settings page";
    this.previous.fontSize = this.next.fontSize = 18;
    this.invalidateLayout();
  }
  override onLayout(): void {
    const rows = this.content.getChildrenPanels().filter(row => !row.collapsed);
    this.start = Math.min(this.start, Math.max(0, rows.length - 1));
    const totalHeight = rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * this.content.spacing;
    const needsPaging = totalHeight > this.height || rows.some(row => row.width > this.width);
    const available = Math.max(1, this.height - (needsPaging && !this.footerNavigation ? 64 : 0));
    // Both directions use the same boundaries, including a short final page.
    // Rebuild from current geometry so resizing or hiding rows cannot leave stale pages.
    this.pageStarts = [0];
    let used = 0;
    const factors = rows.map(row => Math.min(1, this.width / Math.max(1, row.width), available / Math.max(1, row.height)));
    rows.forEach((row, index) => {
      const height = row.height * factors[index];
      if (used > 0 && used + height > available + 0.01) {
        this.pageStarts.push(index);
        used = 0;
      }
      used += height + this.content.spacing;
    });
    this.start = this.pageStarts.filter(start => start <= this.start).at(-1) ?? 0;
    let y = -this.halfHeight;
    let pageFull = false;
    this.end = this.start;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const factor = factors[i];
      row.scale = ex.vec(factor, factor);
      const height = row.height * factor;
      const fits = i >= this.start && !pageFull && y + height <= -this.halfHeight + available + 0.01;
      row.visible = fits;
      if (fits) {
        row.pos = ex.vec(-row.localBounds.center.x * factor, y - row.localBounds.top * factor);
        y += height + this.content.spacing;
        this.end = i + 1;
      } else if (i >= this.start) pageFull = true;
    }
    this.content.pos = ex.vec(0, 0);
    this.previous.visible = this.start > 0;
    this.next.visible = this.end < rows.length;
    if (this.footerNavigation) {
      this.next.bottomRight = ex.vec(this.halfWidth, this.halfHeight + 12 + this.next.height);
      this.previous.bottomRight = ex.vec(this.next.left - 8, this.next.bottom);
    } else {
      this.previous.pos = ex.vec(-this.previous.halfWidth - 8, this.halfHeight - this.previous.halfHeight);
      this.next.pos = ex.vec(this.next.halfWidth + 8, this.halfHeight - this.next.halfHeight);
    }
  }
}
