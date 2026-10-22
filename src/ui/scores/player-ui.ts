import * as ex from "excalibur";
import { PlayerActionsUi } from "@src/player-systems/player-actions-ui";
import { getPlayerActions, PlayerActionTypes } from "@src/player-systems/player-actions";
import { Panel } from "@src/ui/panel";
import { UpgradesModal } from "../upgrades-modal";
import { Level } from "@src/level";
import { Button } from "../elements/button";
import { Label } from "../elements/label";
import { GameMenu } from "../game-menu";
import type { GameMenuPage } from "../game-menu";
import { formatGold, safeInsets, prestigeReward } from "../game-presentation";
import { Resources } from "@src/resources";

export class PlayerUi extends Panel {
  playerActionsUi!: PlayerActionsUi;
  private upgrades!: UpgradesModal;
  private menus!: GameMenu;
  private context!: Label;
  private cancel!: Button;
  private score!: Label;
  private goldIcon!: Panel;
  private ascend!: Button;
  private notice = "";
  private noticeTimer?: ReturnType<typeof setTimeout>;
  notify(text: string): void {
    this.notice = text;
    clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => { this.notice = ""; this.invalidate(); }, 3000);
    this.invalidate();
  }
  private _tooltip: import("@src/player-systems/player-tooltip").Tooltip | null = null;
  get tooltip() { return this._tooltip; }
  set tooltip(value: import("@src/player-systems/player-tooltip").Tooltip | null) {
    if (value?.code === this._tooltip?.code && value?.title === this._tooltip?.title && value?.description === this._tooltip?.description) return;
    this._tooltip = value; this.invalidate();
  }
  private get ownerPlayer() { return this.scene instanceof Level ? this.scene.player : undefined; }
  override onSetup(): void {
    this.z = 1000;
    this.transform.coordPlane = ex.CoordPlane.Screen;
    this.score = this.addPanel("score", Label); this.score.fontSize = 24; this.score.align = "left";
    this.goldIcon = this.addPanel("gold-icon", Panel); this.goldIcon.size = ex.vec(40, 40);
    const gold = ex.Sprite.from(Resources.Dollar); gold.destSize = { width: 40, height: 40 };
    this.goldIcon.addGraphic(gold, ex.vec(-20, -20));
    const menu = this.addPanel("menu", Button); menu.text = "Menu"; menu.fontSize = 15; menu.size = ex.vec(72, 44);
    menu.onClick = () => this.openMenu();
    this.ascend = this.addPanel("ascend", Button); this.ascend.fontSize = 15; this.ascend.size = ex.vec(112, 44);
    this.ascend.tooltip = "Research and Prestige";
    this.ascend.onClick = () => this.openUpgrades("upgrade-ui");
    this.playerActionsUi = this.addPanel("actions", PlayerActionsUi);
    this.playerActionsUi.onBuild = () => this.openMenu("build");
    this.upgrades = this.addPanel("upgrades", UpgradesModal); this.upgrades.visible = false;
    this.menus = this.addPanel("menus", GameMenu); this.menus.visible = false;
    const close = () => { this.upgrades.visible = false; this.menus.visible = false; if (this.ownerPlayer) this.ownerPlayer.currentAction = "NONE"; this.invalidate(); };
    this.upgrades.onClose = close; this.menus.onClose = close;
    this.context = this.addPanel("context", Label); this.context.fontSize = 14;
    this.cancel = this.addPanel("cancel", Button); this.cancel.text = "Done"; this.cancel.fontSize = 14; this.cancel.size = ex.vec(64, 44);
    this.cancel.onClick = () => { if (this.ownerPlayer) this.ownerPlayer.currentAction = "NONE"; };
    this.subscriptions.push({ close: () => clearTimeout(this.noticeTimer) });
    this.subscriptions.push(this.scene!.on("ui-state-changed", () => this.invalidate()));
  }
  openMenu(page: GameMenuPage = "menu"): void {
    this.upgrades.visible = false;
    if (this.ownerPlayer) this.ownerPlayer.currentAction = "NONE";
    this.menus.open(page);
  }
  openUpgrades(tab: "upgrade-ui" | "prestige-ui"): void {
    this.menus.visible = false;
    if (this.ownerPlayer) this.ownerPlayer.currentAction = "NONE";
    this.upgrades.visible = true;
    this.upgrades.currentTab = tab;
    this.upgrades.invalidate();
  }
  override onViewportChanged(): void {
    const inset = safeInsets();
    this.size = ex.vec(this.screenWidth - inset.left - inset.right, this.screenHeight - inset.top - inset.bottom);
    this.pos = ex.vec(inset.left, inset.top);
    this.playerActionsUi?.onViewportChanged();
    this.upgrades?.onViewportChanged();
    this.menus?.onViewportChanged();
    this.invalidate();
  }
  refreshUpgrades(): void { this.upgrades?.invalidate(); this.menus?.invalidate(); this.invalidate(); }
  override onRefresh(): void {
    const player = this.ownerPlayer;
    if (!player) return;
    this.score.text = formatGold(player.score) + (player.prestigePoints > 0 ? "\nPoints: " + formatGold(player.prestigePoints) : "");
    const reward = prestigeReward(player.currentPrestigeScore);
    this.ascend.text = "Ascend" + (reward ? " +" + formatGold(reward) : "");
    this.ascend.maxTextWidth = 92;
    this.ascend.accessibleName = "Ascend: Research and Prestige" + (reward ? ", " + formatGold(reward) + " prestige points available" : "");
    const action = getPlayerActions().find(action => action.code === player.currentAction);
    this.context.text = this.notice || (action
      ? action.code === "REMOVE" ? "Remove · No refund"
        : action.name.replace("Buy Wandering Knight", "Place Knight").replace("Buy ", "Place ") + (action.type === PlayerActionTypes.BUILDABLE ? " · " + formatGold(action.building.cost()) + " gold" : "")
      : this.tooltip?.code === "building-tooltip" ? this.tooltip.title + " · " + this.tooltip.description
        : !player.getData("actions.NEWROLLER") ? "Choose Dice, then tap an empty square" : "");
    this.context.collapsed = !this.context.text;
    this.cancel.collapsed = player.currentAction === "NONE";
    this.playerActionsUi.invalidate();
    this.upgrades.invalidate();
    this.menus.invalidate();
  }
  override onLayout(): void {
    const stacked = this.width < 520;
    this.goldIcon.topLeft = ex.vec(0, 0);
    this.score.maxWidth = Math.max(80, this.width - (stacked ? 48 : 252));
    this.score.topLeft = ex.vec(48, 4);
    const menu = this.getPanel<Button>("menu")!;
    menu.topRight = ex.vec(this.width, stacked ? Math.max(this.score.bottom, this.goldIcon.bottom) + 8 : 0);
    this.ascend.topRight = ex.vec(menu.left - 8, menu.top);
    this.playerActionsUi.bottomCenter = ex.vec(this.width / 2, this.height);
    this.cancel.bottomRight = ex.vec(this.width, this.playerActionsUi.top - 6);
    this.context.maxWidth = Math.max(40, this.width - (this.cancel.collapsed ? 0 : this.cancel.width + 12));
    this.context.bottomLeft = ex.vec(0, this.playerActionsUi.top - 12);
    for (const modal of [this.upgrades, this.menus]) modal.pos = this.size.scale(0.5);
  }
}
