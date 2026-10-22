import * as ex from "excalibur";
import { Level } from "@src/level";
import { ScreenPanel } from "@src/ui/screen-panel";
import { Label } from "@src/ui/elements/label";
import { Button } from "@src/ui/elements/button";
import { addSettingsContent } from "@src/ui/settings-content";
import { wrapContent } from "@src/ui/help-content";
import { safeInsets } from "@src/ui/game-presentation";
import { PanelBackgrounds } from "@src/ui/panel";
import type { ExtendedKeyEvent } from "@src/input/extended-key-event";

export class SettingsUi extends ScreenPanel {
  private title!: Label;
  private note!: Label;
  override onSetup(): void {
    this.background = PanelBackgrounds.Panel;
    this.acceptingInputs = [ex.Keys.Esc];
    this.title = this.addPanel("title", Label); this.title.text = "Settings"; this.title.fontSize = 30;
    this.note = this.addPanel("note", Label); this.note.text = "Changes save automatically"; this.note.fontSize = 14;
    this.note.color = ex.Color.fromHex("#b5b9ae");
    this.title.z = this.note.z = 1;
    this.scroll.useFooterNavigation();
    addSettingsContent(this.content);
    const back = this.addPanel("back", Button); back.text = "Back";
    back.onClick = () => { this.scene?.engine.goToScene("WelcomeScene"); };
  }
  onKeyUp(event: ExtendedKeyEvent): void {
    if (event.key === ex.Keys.Esc) this.getPanel<Button>("back")?.activate();
  }
  override onViewportChanged(): void {
    const inset = safeInsets();
    const width = Math.max(1, this.screenWidth - inset.left - inset.right - 24);
    const height = Math.max(1, this.screenHeight - inset.top - inset.bottom - (this.screenHeight < 450 ? 12 : 24));
    this.size = ex.vec(Math.min(840, width), Math.min(820, height));
    this.pos = ex.vec(inset.left + (this.screenWidth - inset.left - inset.right) / 2,
      inset.top + (this.screenHeight - inset.top - inset.bottom) / 2);
  }
  override onLayout(): void {
    const padding = 20;
    const back = this.getPanel<Button>("back")!;
    this.title.maxWidth = this.width - padding * 2;
    const compact = this.screenHeight < 450 && this.width >= 460;
    this.title.topLeft = ex.vec(-this.halfWidth + padding, -this.halfHeight + (compact ? 12 : padding));
    this.note.maxWidth = compact ? this.width - this.title.width - padding * 3 : this.width - padding * 2;
    if (compact) this.note.rightCenter = ex.vec(this.halfWidth - padding, this.title.center.y);
    else this.note.topLeft = ex.vec(-this.halfWidth + padding, this.title.bottom + 6);
    back.bottomLeft = ex.vec(-this.halfWidth + padding, this.halfHeight - 12);
    const top = Math.max(this.note.bottom, this.title.bottom) + (compact ? 12 : 20);
    const bottom = back.top - 12;
    this.scroll.size = ex.vec(Math.max(1, this.width - padding * 2), Math.max(1, bottom - top));
    this.scroll.pos = ex.vec(0, (top + bottom) / 2);
    wrapContent(this.content, this.scroll.width);
  }
}
export class SettingsScene extends Level {
  private mainPanel?: SettingsUi;
  override onActivate(context: ex.SceneActivationContext): void { super.onActivate(context); this.mainPanel = new SettingsUi(); this.add(this.mainPanel); }
  override onDeactivate(context: ex.SceneActivationContext): void { super.onDeactivate(context); this.mainPanel?.kill(); this.mainPanel = undefined; }
}
