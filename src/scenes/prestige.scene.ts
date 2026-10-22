import { Level } from "@src/level";
import { Button } from "@src/ui/elements/button";
import { Label } from "@src/ui/elements/label";
import { ScreenPanel } from "@src/ui/screen-panel";
import * as ex from "excalibur";
import { GameScene } from "./game.scene";
import { formatGold } from "@src/ui/game-presentation";

class PrestigeResult extends ScreenPanel {
  override onSetup(): void {
    const game = this.scene?.engine.scenes["GameScene"] as GameScene | undefined;
    const result = game?.lastPrestige;
    const title = this.content.addPanel("title", Label); title.text = "A new reign begins"; title.fontSize = 34;
    const summary = this.content.addPanel("summary", Label);
    summary.text = result ? "+" + result.points + " prestige points\n" + formatGold(result.balance) + " points available\nNext run: " + formatGold(result.gold) + " gold" : "Your permanent upgrades carry into the next run.";
    for (const [key, text, spend] of [["spend", "Spend points", true], ["return", "Return to board", false]] as const) {
      const button = this.content.addPanel(key, Button); button.text = text;
      button.onClick = () => { if (game) game.openPrestigeOnLoad = spend; this.scene?.engine.goToScene("GameScene"); };
    }
  }
}
export class PrestigeScene extends Level {
  private mainPanel?: PrestigeResult;
  override onActivate(context: ex.SceneActivationContext): void { super.onActivate(context); this.mainPanel = new PrestigeResult(); this.add(this.mainPanel); }
  override onDeactivate(context: ex.SceneActivationContext): void { super.onDeactivate(context); this.mainPanel?.kill(); this.mainPanel = undefined; }
}
