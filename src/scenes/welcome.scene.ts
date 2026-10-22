import * as ex from "excalibur";
import { Level } from "@src/level";
import { ScreenPanel } from "@src/ui/screen-panel";
import { Panel, PanelBackgrounds } from "@src/ui/panel";
import { Label } from "@src/ui/elements/label";
import { Button } from "@src/ui/elements/button";
import { safeInsets } from "@src/ui/game-presentation";

const development = import.meta.env?.DEV ?? false;
export const Scenes: Record<string, string> = {
  Help: "HowToPlayScene", Settings: "SettingsScene", Updates: "UpdatesScene", Credits: "CreditScene",
  ...(development ? { "UI Gallery": "TestUserInterfaceScene" } : {}),
};

/** Supporting actions page as complete rows; play always stays visible. */
class MenuRow extends Panel {
  override onLayout(): void {
    const buttons = this.getChildrenPanels() as Button[];
    const slot = (this.width - 10 * (buttons.length - 1)) / buttons.length;
    for (const button of buttons) button.maxTextWidth = Math.max(1, slot - 32);
    const height = Math.max(52, ...buttons.map(button => button.getPanel<Label>("label")!.height + 24));
    this.size = ex.vec(this.width, height);
    buttons.forEach((button, index) => {
      button.size = ex.vec(slot, height);
      button.pos = ex.vec(-this.halfWidth + slot / 2 + index * (slot + 10), 0);
    });
  }
}

export class WelcomeUi extends ScreenPanel {
  private title!: Label;
  private subtitle!: Label;
  private play!: Button;
  private note!: Label;
  private version!: Label;
  override onSetup(): void {
    this.background = PanelBackgrounds.Panel;
    this.content.spacing = 10;
    this.scroll.useFooterNavigation();
    this.scroll.getPanel<Button>("previous")!.accessibleName = "Previous menu page";
    this.scroll.getPanel<Button>("next")!.accessibleName = "Next menu page";
    this.title = this.addPanel("title", Label);
    this.title.text = "Roll Masters"; this.title.color = ex.Color.fromHex("#e5c58a");
    this.subtitle = this.addPanel("subtitle", Label);
    this.subtitle.text = "Build your board. Set it in motion. Rise again."; this.subtitle.fontSize = 16;
    this.play = this.addPanel("play", Button); this.play.fontSize = 24;
    this.play.onClick = () => { this.scene?.engine.goToScene("GameScene"); };
    this.note = this.addPanel("note", Label); this.note.fontSize = 14;
    this.version = this.addPanel("version", Label); this.version.fontSize = 12;
    this.version.text = "Version " + (import.meta.env?.VITE_BUILD_VERSION || "dev");
    for (const label of [this.title, this.subtitle, this.note, this.version]) label.z = 1;
    for (const label of [this.subtitle, this.note, this.version]) label.color = ex.Color.fromHex("#b5b9ae");
    Object.entries(Scenes).forEach(([title, scene], index) => {
      const row = this.content.addPanel(`row-${Math.floor(index / 2)}`, MenuRow);
      const button = row.addPanel(title, Button);
      button.text = title === "Help" ? "How to play" : title; button.fontSize = 18; button.quiet = true;
      button.onClick = () => { this.scene?.engine.goToScene(scene); };
    });
    if (this.scene instanceof Level) this.scene.inputSystem?.setFocus(this.play);
  }
  override onRefresh(): void {
    let hasSave = false;
    try { hasSave = localStorage.getItem("save") !== null; } catch { /* Starting remains available without storage. */ }
    this.play.text = hasSave ? "Continue" : "Start game";
    this.note.text = hasSave ? "Your board is ready when you are." : "Your first roll starts here.";
  }
  override onViewportChanged(): void {
    const inset = safeInsets();
    this.size = ex.vec(Math.min(680, Math.max(1, this.screenWidth - inset.left - inset.right - 24)),
      Math.min(660, Math.max(1, this.screenHeight - inset.top - inset.bottom - 16)));
    this.pos = ex.vec(inset.left + (this.screenWidth - inset.left - inset.right) / 2,
      inset.top + (this.screenHeight - inset.top - inset.bottom) / 2);
    this.invalidateLayout();
  }
  override onLayout(): void {
    const compact = this.screenHeight < 450;
    const width = Math.max(1, this.width - 32);
    this.title.fontSize = compact ? 30 : this.width < 400 ? 34 : 46;
    this.subtitle.collapsed = compact;
    this.note.collapsed = compact;
    for (const label of [this.title, this.subtitle, this.note]) label.maxWidth = width;
    this.title.topCenter = ex.vec(0, -this.halfHeight + 16);
    this.subtitle.topCenter = ex.vec(0, this.title.bottom + 8);
    this.play.maxTextWidth = width - 48;
    this.play.size = ex.vec(width, Math.max(compact ? 56 : 68, this.play.getPanel<Label>("label")!.height + 24));
    this.play.topCenter = ex.vec(0, (compact ? this.title.bottom : this.subtitle.bottom) + (compact ? 10 : 24));
    this.note.topCenter = ex.vec(0, this.play.bottom + 8);
    this.version.maxWidth = Math.max(1, width - 148);
    this.version.bottomLeft = ex.vec(-width / 2, this.halfHeight - 12);
    const top = (compact ? this.play.bottom : this.note.bottom) + 16;
    const bottom = this.halfHeight - 72;
    this.scroll.size = ex.vec(width, Math.max(1, bottom - top));
    this.scroll.pos = ex.vec(0, (top + bottom) / 2);
    for (const row of this.content.getChildrenPanels()) row.size = ex.vec(width, row.height);
  }
}

export class WelcomeScene extends Level {
  private mainPanel?: WelcomeUi;
  override onActivate(context: ex.SceneActivationContext): void { super.onActivate(context); this.mainPanel = new WelcomeUi(); this.add(this.mainPanel); }
  override onDeactivate(context: ex.SceneActivationContext): void { super.onDeactivate(context); this.mainPanel?.kill(); this.mainPanel = undefined; }
}
