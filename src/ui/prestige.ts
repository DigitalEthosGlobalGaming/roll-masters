import { Label } from "@src/ui/elements/label";
import { List } from "@src/ui/elements/list";
import * as ex from "excalibur";
import { UpgradeUi } from "./upgrades";
import { UpgradeListItem } from "./upgrade-list-item";
import { Button } from "./elements/button";
import { UpgradesModal } from "./upgrades-modal";
import { Environment } from "@src/env";

export class PrestigeUi extends UpgradeUi {
  onRender() {
    if (this.player == null) {
      return;
    }
    let parent = this.parentPanel;
    if (parent == null || !(parent instanceof UpgradesModal)) {
      return;
    }
    let totalPrestiges = this.player.totalPrestiges ?? 0;
    const title = this.addPanel("title", Label);
    title.top = 40;
    if (totalPrestiges == 0) {
      title.text = "Prestige";
    } else {
      title.text = `Prestige (${totalPrestiges})`;
    }
    title.fontSize = 40;

    let prestigePoints = Math.max(Math.floor(
      (this.player.currentPrestigeScore) / 1000000
    ), 0);

    const prestige = this.addPanel("prestige", Button);
    if (prestigePoints == 0 && !Environment.isDev) {
      prestige.disabled = true;
    }
    prestige.text = `PRESTIGE +${prestigePoints}⏣`;
    prestige.fontSize = 20;
    prestige.top = title.height + 50;
    prestige.tooltip = `Prestige to gain ${prestigePoints}⏣, 1 ⏣ for every 1 million gold earned.`;
    prestige.onPointerUp = () => {
      if (prestige.disabled) {
        return;
      }
      const confirmText = "Are you sure?";
      if (prestige.text == confirmText) {
        this.player?.getScene()?.prestige();
      } else {
        prestige.text = confirmText;
      }
    };

    const info = this.addPanel("prestige-info", Label);
    info.top = prestige.bottom + 20;
    info.left = -this.getParentBounds().width / 2 + 50;
    info.text = `Current: ${this.player.prestigePoints}⏣`;
    info.fontSize = 20;

    const upgrades = this.player.upgrades.filter(
      (u) => u.canResearch && u.type == "PRESTIGE"
    );
    if (upgrades.length == 0) {
      const info = this.addPanel("info", Label);
      info.fontSize = 24;
      info.top = info.bottom;
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
      list.topLeft = ex.vec(
        -this.getParentBounds().width / 2,
        info.bottom + 10
      );
    }
  }
}
