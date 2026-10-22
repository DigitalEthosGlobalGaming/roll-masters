import * as ex from "excalibur";
import { Button } from "./elements/button";
import { Label } from "./elements/label";
import { Panel } from "./panel";
import { ScrollPanel } from "./scroll-panel";
import { UpgradeListItem } from "./upgrade-list-item";
import { Level } from "@src/level";
import { formatGold } from "./game-presentation";
import { buyMode } from "./buy-mode";

export class UpgradeUi extends Panel {
  onNavigate: (tab: "upgrade-ui" | "prestige-ui") => void = () => {};
  protected title!: Label;
  protected wallet!: Label;
  protected scroll!: ScrollPanel;
  protected info!: Label;
  protected prestigeButton!: Button;
  protected section!: Label;
  private completed!: Button;
  private showCompleted = false;
  private buyTen!: Button;
  private buyMax!: Button;
  private unsubscribeBuyMode?: () => void;
  protected get player() { return this.scene instanceof Level ? this.scene.player : undefined; }
  protected get upgradeType(): "RESEARCH" | "PRESTIGE" { return "RESEARCH"; }
  override onSetup(): void {
    this.title = this.addPanel("title", Label); this.title.fontSize = 30; this.title.align = "left"; this.title.color = ex.Color.fromHex("#e1c99d");
    this.wallet = this.addPanel("wallet", Label); this.wallet.fontSize = 17; this.wallet.align = "left"; this.wallet.color = ex.Color.fromHex("#c6c3b9");
    this.section = this.addPanel("section", Label); this.section.fontSize = 15; this.section.align = "left"; this.section.color = ex.Color.fromHex("#c9a66a");
    this.section.text = "RESEARCH UPGRADES";
    this.scroll = this.addPanel("rows", ScrollPanel);
    this.info = this.scroll.content.addPanel("info", Label); this.info.fontSize = 18;
    this.info.text = "Keep playing to unlock upgrades!";
    this.completed = this.scroll.content.addPanel("completed", Button); this.completed.fontSize = 17;
    this.completed.onClick = () => { this.showCompleted = !this.showCompleted; this.invalidate(); };
    this.prestigeButton = this.addPanel("prestige", Button); this.prestigeButton.fontSize = 18;
    this.prestigeButton.text = "Prestige";
    this.prestigeButton.onClick = () => this.onNavigate("prestige-ui");
    this.buyTen = this.addPanel("buy-ten", Button); this.buyTen.fontSize = 16; this.buyTen.text = "x10";
    this.buyTen.tooltip = { code: "buy-ten", title: "Buy 10", description: "Buy 10 levels at once. Hold Ctrl for the same effect." };
    this.buyTen.onClick = () => buyMode.setToggle("ten");
    this.buyMax = this.addPanel("buy-max", Button); this.buyMax.fontSize = 16; this.buyMax.text = "Max";
    this.buyMax.tooltip = { code: "buy-max", title: "Buy max", description: "Buy as many levels as you can afford. Hold Shift for the same effect." };
    this.buyMax.onClick = () => buyMode.setToggle("max");
    this.unsubscribeBuyMode = buyMode.subscribe(() => this.invalidate());
  }
  override kill(): void {
    this.unsubscribeBuyMode?.();
    this.unsubscribeBuyMode = undefined;
    super.kill();
  }
  override onRefresh(): void {
    const player = this.player;
    if (!player) return;
    this.title.text = "Research";
    this.wallet.text = "Gold: " + formatGold(player.score ?? 0);
    const upgrades = player.upgrades.filter(upgrade => upgrade.canResearch && upgrade.type === this.upgradeType);
    const keys = new Set(upgrades.map(upgrade => upgrade.code));
    for (const row of this.scroll.content.getChildrenPanels()) {
      if (row instanceof UpgradeListItem && !keys.has(row.name)) this.scroll.content.removePanel(row);
    }
    this.info.collapsed = upgrades.length > 0;
    const completedCount = upgrades.filter(upgrade => upgrade.isMaxLevel).length;
    this.completed.collapsed = completedCount === 0;
    this.completed.text = (this.showCompleted ? "Hide" : "Show") + " completed (" + completedCount + ")";
    for (const upgrade of upgrades) {
      const row = this.scroll.content.addPanel(upgrade.code, UpgradeListItem);
      row.upgrade = upgrade;
      row.collapsed = upgrade.isMaxLevel && !this.showCompleted;
      row.onBuy = () => this.invalidate(); row.invalidate();
    }
    this.prestigeButton.visible = true;
    this.buyTen.selected = buyMode.mode === "ten";
    this.buyMax.selected = buyMode.mode === "max";
  }
  protected get extraHeaderHeight(): number { return 0; }
  override onLayout(): void {
    if (this.height < 420 && this.width > 500) {
      const summaryWidth = Math.floor(this.width * 0.36);
      this.title.maxWidth = summaryWidth;
      this.wallet.maxWidth = summaryWidth;
      this.title.pos = ex.vec(-this.halfWidth + this.title.halfWidth, -this.halfHeight + this.title.halfHeight);
      this.wallet.pos = ex.vec(-this.halfWidth + this.wallet.halfWidth, this.title.bottom + 8 + this.wallet.halfHeight);
      this.prestigeButton.pos = ex.vec(-this.halfWidth + this.prestigeButton.halfWidth, this.halfHeight - this.prestigeButton.halfHeight);
      this.section.collapsed = true;
      const toggleTop = this.prestigeButton.top - 12 - this.buyTen.height;
      this.buyTen.pos = ex.vec(-this.halfWidth + this.buyTen.halfWidth, toggleTop + this.buyTen.halfHeight);
      this.buyMax.pos = ex.vec(this.buyTen.right + 8 + this.buyMax.halfWidth, this.buyTen.pos.y);
      this.scroll.size = ex.vec(this.width - summaryWidth - 16, this.height);
      this.scroll.pos = ex.vec(-this.halfWidth + summaryWidth + 16 + this.scroll.halfWidth, -this.halfHeight + this.scroll.halfHeight);
      this.info.maxWidth = this.scroll.width;
      for (const row of this.scroll.content.getChildrenPanels()) if (row instanceof UpgradeListItem) row.availableWidth = this.scroll.width;
      return;
    }
    this.title.maxWidth = this.width;
    this.section.collapsed = false;
    this.title.pos = ex.vec(-this.halfWidth + this.title.halfWidth, -this.halfHeight + this.title.halfHeight);
    this.wallet.maxWidth = this.width;
    this.wallet.pos = ex.vec(-this.halfWidth + this.wallet.halfWidth, this.title.bottom + 10 + this.wallet.halfHeight);
    this.prestigeButton.pos = ex.vec(0, this.halfHeight - this.prestigeButton.halfHeight);
    this.section.pos = ex.vec(-this.halfWidth + this.section.halfWidth, this.wallet.bottom + 24 + this.extraHeaderHeight + this.section.halfHeight);
    this.buyMax.pos = ex.vec(this.halfWidth - this.buyMax.halfWidth, this.section.pos.y);
    this.buyTen.pos = ex.vec(this.buyMax.left - 8 - this.buyTen.halfWidth, this.section.pos.y);
    const top = Math.max(this.section.bottom, this.buyTen.bottom) + 12;
    this.scroll.size = ex.vec(this.width, Math.max(1, this.prestigeButton.top - top - 12));
    this.scroll.pos = ex.vec(0, top + this.scroll.halfHeight);
    this.info.maxWidth = this.width;
    for (const row of this.scroll.content.getChildrenPanels()) if (row instanceof UpgradeListItem) row.availableWidth = this.width;
  }
}
