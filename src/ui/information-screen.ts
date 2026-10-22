import * as ex from "excalibur";
import { ScreenPanel } from "./screen-panel";
import { PanelBackgrounds } from "./panel";
import { Label } from "./elements/label";
import { Button } from "./elements/button";
import { InformationCard } from "./information-card";
import type { InformationEntry } from "./information-card";
import { safeInsets } from "./game-presentation";
import { wrapContent } from "./help-content";
import type { ExtendedKeyEvent } from "@src/input/extended-key-event";

export class InformationScreen extends ScreenPanel {
  private title!: Label;
  private note!: Label;
  constructor(readonly heading: string, readonly subtitle: string, readonly entries: InformationEntry[]) { super(); }
  override onSetup(): void {
    this.background = PanelBackgrounds.Panel;
    this.acceptingInputs = [ex.Keys.Esc];
    this.title = this.addPanel("title", Label); this.title.text = this.heading;
    this.title.fontSize = 30; this.title.color = ex.Color.fromHex("#e5c58a");
    this.note = this.addPanel("note", Label); this.note.text = this.subtitle;
    this.note.fontSize = 15; this.note.color = ex.Color.fromHex("#b5b9ae");
    this.title.z = this.note.z = 1;
    this.scroll.useFooterNavigation();
    for (const [key, caption] of [["previous", "Previous page"], ["next", "Next page"]]) {
      const button = this.scroll.getPanel<Button>(key)!; button.accessibleName = `${this.heading}: ${caption}`; button.quiet = true;
    }
    this.entries.forEach((entry, index) => this.content.addPanel(`entry-${index}`, InformationCard, entry));
    const back = this.addPanel("back", Button); back.text = "Back"; back.quiet = true;
    back.onClick = () => { this.scene?.engine.goToScene("WelcomeScene"); };
  }
  onKeyUp(event: ExtendedKeyEvent): void {
    if (event.key === ex.Keys.Esc) this.getPanel<Button>("back")?.activate();
  }
  override onViewportChanged(): void {
    const inset = safeInsets();
    this.size = ex.vec(Math.min(840, Math.max(1, this.screenWidth - inset.left - inset.right - 24)),
      Math.min(820, Math.max(1, this.screenHeight - inset.top - inset.bottom - 12)));
    this.pos = ex.vec(inset.left + (this.screenWidth - inset.left - inset.right) / 2,
      inset.top + (this.screenHeight - inset.top - inset.bottom) / 2);
    this.invalidateLayout();
  }
  override onLayout(): void {
    const padding = 16, compact = this.screenHeight < 450;
    const width = Math.max(1, this.width - padding * 2);
    this.title.maxWidth = this.note.maxWidth = width;
    this.note.collapsed = compact;
    this.title.topLeft = ex.vec(-this.halfWidth + padding, -this.halfHeight + (compact ? 12 : 20));
    this.note.topLeft = ex.vec(this.title.left, this.title.bottom + 6);
    const back = this.getPanel<Button>("back")!;
    back.bottomLeft = ex.vec(-this.halfWidth + padding, this.halfHeight - 12);
    const top = (compact ? this.title.bottom : this.note.bottom) + (compact ? 12 : 20);
    const bottom = back.top - 12;
    this.scroll.size = ex.vec(width, Math.max(1, bottom - top));
    this.scroll.pos = ex.vec(0, (top + bottom) / 2);
    wrapContent(this.content, width);
  }
}
