import {
  getPlayerActions,
  PlayerActions
} from "@src/player-systems/player-actions";
import { PlayerActionsUi } from "@src/player-systems/player-actions-ui";
import { PlayerTooltip, Tooltip } from "@src/player-systems/player-tooltip";
import { Panel } from "@src/ui/panel";
import * as ex from "excalibur";
import { UpgradesModal } from "../upgrades-modal";

export class PlayerUi extends Panel {
  isMoving = false;
  playerActionsUi?: PlayerActionsUi;
  private _tooltipElement?: PlayerTooltip;

  private _tooltip: Tooltip | null = null;
  get tooltip(): Tooltip | null {
    return this._tooltip;
  }
  set tooltip(value: Tooltip | null) {
    this._tooltip = value;
    this.dirty = true;
  }

  get currentAction(): PlayerActions | null {
    let item = getPlayerActions().find((a) => a.code == this.player?.currentAction);
    return item?.code ?? null;
  }

  get acceptingInputs() {
    return false;
  }

  onRender(): void {
    const bounds = this.scene?.camera?.viewport;
    if (bounds == null) {
      throw new Error("Bounds are null");
    }
    this.pos = ex.vec(-bounds.width / 2, -bounds.height / 2);
    this.size = ex.vec(bounds.width, bounds.height);
    this.z = 1000;

    super.onRender();
    if (this.playerActionsUi == null) {
      this.playerActionsUi = this.addPanel(
        "player-actions-ui",
        PlayerActionsUi
      );
    }
    const upgradesPanel = this.addPanel("upgrades-modal", UpgradesModal);
    upgradesPanel.visible = this.currentAction == "UPGRADES";
    upgradesPanel.pos = ex.vec(bounds.width / 2, bounds.height / 2);
    if (this._tooltipElement == null) {
      this._tooltipElement = this.addPanel("player-tooltip", PlayerTooltip);
    }
    this._tooltipElement.tooltip = this.tooltip;
    this._tooltipElement.fontSize = 20;
    this._tooltipElement.pos = ex.vec(
      bounds.width - this._tooltipElement.halfWidth - 10,
      10
    );
  }
}
