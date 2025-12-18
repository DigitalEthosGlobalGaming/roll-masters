import { Button } from "@src/ui/elements/button";
import { Label } from "@src/ui/elements/label";
import { List } from "@src/ui/elements/list";
import { Panel } from "@src/ui/panel";
import * as ex from "excalibur";
import { UpgradeListItem } from "./upgrade-list-item";
import { UpgradesModal } from "./upgrades-modal";
import { Environment } from "@src/env";

export class UpgradeUi extends Panel {
  onRender() {
    if (this.player == null) {
      return;
    }
    const title = this.addPanel("title", Label);
    title.pos = ex.vec(0, title.halfHeight + 40);
    title.text = "Research";
    title.fontSize = 40;

    const upgrades = this.player.upgrades.filter(
      (u) => u.canResearch && u.type == "RESEARCH"
    );
    if (upgrades.length == 0) {
      const info = this.addPanel("info", Label);
      info.fontSize = 24;
      info.pos = ex.vec(0, title.pos.y + title.height + info.halfHeight);
      info.text = "Keep playing to unlock upgrades!";
    } else {
      this.removePanel("info");
      const list = this.addPanel("list", List);
      list.spacing = 20;

      for (const i in upgrades) {
        const upgrade = upgrades[i];
        if (upgrade.canResearch) {
          const upgradePanel = list.addPanel(upgrade.code, UpgradeListItem);
          upgradePanel.upgrade = upgrade;
        } else {
          list.removePanel(upgrade.code);
        }
      }
      list.pos = ex.vec(
        -this.getParentBounds().width / 2 + 20,
        title.pos.y + title.height + list.halfHeight
      );

      if (this.player.currentPrestigeScore > 1000000 || Environment.isDev || this.player.prestigePoints > 0) {
        let parent = this.parentPanel;
        if (parent != null) {
          const prestige = this.addPanel("prestige", Button);
          prestige.text = "PRESTIGE";
          prestige.fontSize = 20;
          prestige.pos = ex.vec(0, parent.height - this.halfHeight - 30);
          prestige.tooltip =
            "Prestige to gain ⏣, earn 1 ⏣ for every 1 million gold earned.";
          prestige.onClick = () => {
            if (parent instanceof UpgradesModal) {
              parent.currentTab = "prestige-ui";
            }
          };
        }
      }
    }
  }
}
