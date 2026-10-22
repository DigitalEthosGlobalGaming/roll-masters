import * as ex from "excalibur";
import { Modal } from "./modal";
import { Label } from "./elements/label";
import { Button } from "./elements/button";
import { ScrollPanel } from "./scroll-panel";
import { Level } from "@src/level";
import { formatGold, prestigeReward } from "./game-presentation";

export class PrestigeConfirmation extends Modal {
  private summary!: Label;
  private reset!: Label;
  private keep!: Label;
  private start!: Label;
  private scroll!: ScrollPanel;
  private confirm!: Button;
  override onSetup(): void {
    super.onSetup();
    this.z = 200;
    this.closeButton.text = "Keep playing";
    this.scroll = this.addPanel("summary-scroll", ScrollPanel);
    this.summary = this.scroll.content.addPanel("summary", Label); this.summary.fontSize = 18; this.summary.align = "left";
    this.reset = this.scroll.content.addPanel("reset", Label);
    this.reset.text = "Reset: your board, gold, research and building unlocks.";
    this.keep = this.scroll.content.addPanel("keep", Label);
    this.start = this.scroll.content.addPanel("start", Label);
    for (const label of [this.reset, this.keep, this.start]) { label.fontSize = 18; label.align = "left"; }
    this.confirm = this.addPanel("confirm", Button); this.confirm.text = "Prestige and restart"; this.confirm.fontSize = 18;
    this.confirm.onClick = () => {
      const player = this.scene instanceof Level ? this.scene.player : undefined;
      if (player && prestigeReward(player.currentPrestigeScore) > 0) player.getScene().prestige();
    };
  }
  override onRefresh(): void {
    const player = this.scene instanceof Level ? this.scene.player : undefined;
    if (player) {
      const reward = prestigeReward(player.currentPrestigeScore);
      this.summary.text = "Prestige this run?\nGain " + reward + " points.";
      this.keep.text = "Keep: permanent upgrades and " + formatGold(player.prestigePoints) + " unspent points.";
      this.start.text = "Next run starts with " + formatGold((player.totalPrestiges + 1) * 100 + 10) + " gold.";
      this.confirm.disabled = reward < 1;
    }
    super.onRefresh();
  }
  override onLayout(): void {
    this.closeButton.bottomCenter = ex.vec(0, this.halfHeight - 12);
    this.confirm.bottomCenter = ex.vec(0, this.closeButton.top - 10);
    this.scroll.size = ex.vec(this.width - 36, Math.max(1, this.height - this.closeButton.height - this.confirm.height - 48));
    this.scroll.topCenter = ex.vec(0, -this.halfHeight + 16);
    for (const label of [this.summary, this.reset, this.keep, this.start]) label.maxWidth = this.scroll.width;
  }
}
