import { UpgradeUi } from "./upgrades";
import { Button } from "./elements/button";
import { prestigeReward, formatGold, prestigeThreshold } from "./game-presentation";
import { PrestigeConfirmation } from "./prestige-confirmation";
import * as ex from "excalibur";

export class PrestigeUi extends UpgradeUi {
  private confirm = false;
  private perform!: Button;
  private confirmation!: PrestigeConfirmation;
  protected override get upgradeType(): "PRESTIGE" { return "PRESTIGE"; }
  resetConfirmation(): void { this.confirm = false; if (this.confirmation) this.confirmation.visible = false; this.invalidate(); }
  override onSetup(): void {
    super.onSetup();
    this.section.text = "PERMANENT UPGRADES";
    this.perform = this.addPanel("perform", Button); this.perform.fontSize = 18;
    this.confirmation = this.addPanel("confirmation", PrestigeConfirmation); this.confirmation.visible = false;
    this.confirmation.onClose = () => this.resetConfirmation();
    this.perform.onClick = () => { this.confirm = true; this.confirmation.visible = true; this.invalidate(); };
    this.prestigeButton.text = "Research";
    this.prestigeButton.onClick = () => { this.resetConfirmation(); this.onNavigate("upgrade-ui"); };
  }
  override onRefresh(): void {
    super.onRefresh();
    if (!this.player) return;
    const earned = this.player.currentPrestigeScore;
    const points = prestigeReward(earned);
    const remaining = (points + 1) * prestigeThreshold - earned;
    this.title.text = "Prestige";
    const short = this.screenHeight < 520 && this.screenWidth > 620;
    this.wallet.text = formatGold(this.player.prestigePoints) + " points available" + (short ? "\n" : " · ") + formatGold(earned) + " gold this run" + (short ? "" : "\n" + formatGold(remaining) + " gold to the next point");
    this.perform.disabled = points === 0;
    this.perform.text = this.confirm ? "Confirm prestige" : points === 0 ? "Earn " + formatGold(remaining) + " more gold" : "Prestige · Gain " + points + (points === 1 ? " point" : " points");
    this.prestigeButton.visible = true;
    this.confirmation.invalidate();
  }
  protected override get extraHeaderHeight(): number { return (this.perform?.height ?? 0) + 12; }
  override onLayout(): void {
    this.perform.maxTextWidth = Math.max(80, (this.height < 420 && this.width > 500 ? Math.floor(this.width * 0.36) : this.width) - 40);
    super.onLayout();
    this.perform.pos = ex.vec(-this.halfWidth + this.perform.halfWidth, this.wallet.bottom + 12 + this.perform.halfHeight);
    this.confirmation.pos = this.pos.scale(-1);
  }
}
