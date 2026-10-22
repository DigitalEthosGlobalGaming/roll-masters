import { Panel } from "./panel";
import { ScrollPanel } from "./scroll-panel";
import * as ex from "excalibur";
import { wrapContent } from "./help-content";
import { safeInsets } from "./game-presentation";
import { Level } from "@src/level";
import { Button } from "./elements/button";

/** Reusable viewport root for menu screens. Content is built once in onSetup. */
export class ScreenPanel extends Panel {
  protected scroll: ScrollPanel;
  constructor() { super(); this.transform.coordPlane = ex.CoordPlane.Screen; this.scroll = this.addPanel("scroll", ScrollPanel); }
  protected get content() { return this.scroll.content; }
  override onViewportChanged(): void {
    const inset = safeInsets();
    this.size = ex.vec(Math.min(760, this.screenWidth * 0.9, this.screenWidth - inset.left - inset.right), Math.min(this.screenHeight * 0.9, this.screenHeight - inset.top - inset.bottom));
    this.pos = this.screenSize.scale(0.5);
    this.invalidateLayout();
  }
  override onLayout(): void {
    wrapContent(this.content, this.width - 24);
    const back = this.getPanel<Button>("back");
    const footer = back ? back.height + 12 : 0;
    this.scroll.size = ex.vec(this.width, Math.max(1, this.height - footer));
    this.scroll.pos = ex.vec(0, -footer / 2);
    if (back) back.bottomCenter = ex.vec(0, this.halfHeight);
  }
  override onRender(): void {
    if (this.scene instanceof Level && !this.getChildrenPanels().some(panel => panel.focused)) {
      // Only choose an initial focus; subsequent pointer/keyboard choices remain owned by input.
      if (!this.focusAssigned) {
        const first = this.content.getChildrenPanels().find(panel => panel instanceof Button) ?? this.getPanel<Button>("back");
        if (first) { this.scene.inputSystem?.setFocus(first); this.focusAssigned = true; }
      }
    }
  }
  private focusAssigned = false;
}
