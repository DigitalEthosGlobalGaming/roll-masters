import * as ex from "excalibur";
import { Panel } from "@src/ui/panel";
import { Button } from "@src/ui/elements/button";
import { PlayerActionTypes, getPlayerActions } from "./player-actions";
import type { PlayerAction } from "./player-actions";
import { Level } from "@src/level";
import { formatGold, formatCompactGold } from "@src/ui/game-presentation";
import { Resources } from "@src/resources";
import { actionTooltip } from "./player-tooltip";

export class PlayerActionButton extends Button {
  action?: PlayerAction;
  setFocused(value: boolean): void { this.selected = value; }
}
export class PlayerActionsUi extends Panel {
  buttons: PlayerActionButton[] = [];
  onBuild: () => void = () => {};
  private roll!: Button;
  private build!: Button;
  private get player() { return this.scene instanceof Level ? this.scene.player : undefined; }
  private get compact(): boolean { return this.screenWidth < 900; }
  get playerActions(): PlayerAction[] { return getPlayerActions().filter(action => action.type === PlayerActionTypes.BUILDABLE); }
  changeAction(action: PlayerAction): void {
    if (this.player && action.unlocked) this.player.currentAction = action.code;
  }
  override onSetup(): void {
    this.roll = this.addPanel("roll", Button); this.roll.text = "Roll";
    this.roll.icon = { imageSource: Resources.Dice6, width: 32, height: 32 };
    this.roll.iconPlacement = "above";
    this.roll.onClick = () => { if (this.player) this.player.currentAction = "NONE"; };
    for (const action of this.playerActions) {
      const button = this.addPanel(action.code, PlayerActionButton);
      button.action = action;
      button.icon = { imageSource: action.image, width: 32, height: 32 };
      button.iconPlacement = "above";
      button.onClick = () => this.changeAction(action);
      this.buttons.push(button);
    }
    this.build = this.addPanel("build", Button); this.build.text = "Build";
    this.build.icon = { imageSource: Resources.ChessPawn, width: 32, height: 32 };
    this.build.iconPlacement = "above";
    this.build.onClick = () => this.onBuild();
  }
  override onRefresh(): void {
    this.roll.selected = this.player?.currentAction === "NONE";
    for (const button of this.buttons) {
      const action = button.action!;
      if (action.type !== PlayerActionTypes.BUILDABLE) continue;
      // Pieces stay hidden until unlocked, so the toolbar never spoils what is ahead.
      button.collapsed = !action.unlocked || this.compact && action.code !== "NEWDICE" && action.code !== "REMOVE";
      button.disabled = !action.unlocked;
      button.tooltip = actionTooltip(action);
      button.selected = action.code === this.player?.currentAction;
      const name = action.code === "NEWKNIGHT" ? "Knight" : action.name.replace("Buy ", "");
      button.text = action.code === "REMOVE" ? "Remove" : action.unlocked ? formatCompactGold(action.building.cost()) : "Locked";
      button.accessibleName = name + (action.code === "REMOVE" ? "" : action.unlocked ? ", " + formatGold(action.building.cost()) + " gold" : ", locked");
    }
    this.build.collapsed = !this.compact;
  }
  override onViewportChanged(): void { this.invalidate(); }
  protected override measure(): ex.BoundingBox {
    return this.centeredSize(this.parentPanel?.width ?? this.screenWidth, 84);
  }
  override onLayout(): void {
    const order = this.compact
      ? [this.roll, this.getPanel<Button>("NEWDICE")!, this.build, this.getPanel<Button>("REMOVE")!]
      : [this.roll, ...this.buttons.filter(button => !button.collapsed)];
    const slot = Math.min(100, (this.width - 8) / order.length);
    order.forEach((button, index) => {
      button.fontSize = 14;
      button.maxTextWidth = slot - 16;
      button.size = ex.vec(slot - 4, 80);
      button.pos = ex.vec((index - (order.length - 1) / 2) * slot, 0);
    });
  }
}
