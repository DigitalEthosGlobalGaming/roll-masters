import * as ex from "excalibur";
import { PlayerActionsUi } from "@src/player-systems/player-actions-ui";
import { getPlayerActions } from "@src/player-systems/player-actions";
import { Panel } from "@src/ui/panel";
import { UpgradesModal } from "../upgrades-modal";
import { Level } from "@src/level";
import { Button } from "../elements/button";
import { Label } from "../elements/label";
import { GameMenu } from "../game-menu";
import type { GameMenuPage } from "../game-menu";
import { formatGold, safeInsets, prestigeReward } from "../game-presentation";
import { Resources } from "@src/resources";
import { TooltipCard } from "../tooltip-card";
import { Toast } from "../toast";
import type { ToastKind } from "../toast";
import { TutorialOverlay } from "@src/tutorial/tutorial-overlay";
import type { TutorialRect } from "@src/tutorial/tutorial-overlay";
import type { TutorialTarget } from "@src/tutorial/tutorial-steps";
import type { Tooltip } from "@src/player-systems/player-tooltip";

export class PlayerUi extends Panel {
  playerActionsUi!: PlayerActionsUi;
  private upgrades?: UpgradesModal;
  private menus?: GameMenu;
  private context!: Label;
  private cancel!: Button;
  private score!: Label;
  private goldIcon!: Panel;
  private ascend!: Button;
  private tooltipCard!: TooltipCard;
  private tutorial!: TutorialOverlay;
  private toast!: Toast;
  /** Show a transient alert; warnings add a short shake unless motion is reduced. */
  notify(text: string, kind: ToastKind = "info"): void { this.toast.show(text, kind); }
  private _tooltip: Tooltip | null = null;
  get tooltip() { return this._tooltip; }
  set tooltip(value: Tooltip | null) {
    if (value?.code === this._tooltip?.code && value?.title === this._tooltip?.title && value?.description === this._tooltip?.description && value?.cost === this._tooltip?.cost) return;
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
    // Hover/focus tooltips apply to the toolbar and Ascend; panels inside modals stay quiet.
    const services = {
      showTooltip: (value: unknown) => this.ownerPlayer?.showTooltip(value as Tooltip),
      hideTooltip: (value: unknown) => this.ownerPlayer?.hideTooltip(value as Tooltip),
    };
    this.playerActionsUi.services = services;
    this.ascend.services = services;
    this.context = this.addPanel("context", Label); this.context.fontSize = 14;
    this.tooltipCard = this.addPanel("tooltip-card", TooltipCard);
    this.tutorial = this.addPanel("tutorial", TutorialOverlay);
    this.tutorial.locate = this.locateTarget;
    this.tutorial.notify = (text, kind) => this.notify(text, kind);
    this.toast = this.addPanel("toast", Toast);
    this.cancel = this.addPanel("cancel", Button); this.cancel.text = "Done"; this.cancel.fontSize = 14; this.cancel.size = ex.vec(64, 44);
    this.cancel.onClick = () => { if (this.ownerPlayer) this.ownerPlayer.currentAction = "NONE"; };
    this.subscriptions.push(this.scene!.on("ui-state-changed", () => this.refreshUpgrades()));
    this.subscriptions.push(this.scene!.on("ui-score-changed", () => {
      this.invalidateState();
      this.upgrades?.invalidateState();
      // Build and upgrade costs remain current if a modal is open while scoring.
      if (this.menus?.visible) this.menus.invalidateState();
    }));
  }
  /** Replay the first-run tutorial from the beginning. */
  startTutorial(): void {
    if (this.upgrades) this.upgrades.visible = false;
    if (this.menus) this.menus.visible = false;
    this.tutorial.begin(0);
  }
  /** HUD-space geometry for a tutorial target, or null while it is not on screen. */
  private locateTarget = (target: TutorialTarget): TutorialRect | null => {
    const origin = this.globalPos;
    const ofPanel = (panel: Panel | null | undefined): TutorialRect | null =>
      panel?.rendered ? { center: panel.globalPos.sub(origin), size: panel.size } : null;
    const actions = this.playerActionsUi;
    if (target === "action:roll") return ofPanel(actions.getPanel("roll"));
    if (target === "action:NEWDICE") return ofPanel(actions.getPanel("NEWDICE"));
    // Small screens fold the other pieces behind Build.
    if (target === "action:NEWROLLER") return ofPanel(actions.getPanel("NEWROLLER")) ?? ofPanel(actions.getPanel("build"));
    if (target === "ascend") return ofPanel(this.ascend);
    const scene = this.scene;
    const world = this.ownerPlayer?.tutorialTarget(target === "board:spot" ? "spot" : target === "board:dice" ? "dice" : target === "board:pawn" ? "pawn" : "pawn-spot");
    if (!scene || !world) return null;
    const center = scene.engine.worldToScreenCoordinates(world).sub(origin);
    if (center.x < -32 || center.y < -32 || center.x > this.width + 32 || center.y > this.height + 32) return null;
    const side = 32 * scene.camera.zoom;
    return { center, size: ex.vec(side, side) };
  };
  private closeModals = () => {
    if (this.upgrades) this.upgrades.visible = false;
    if (this.menus) this.menus.visible = false;
    if (this.ownerPlayer) this.ownerPlayer.currentAction = "NONE";
    this.invalidateState();
  };
  openMenu(page: GameMenuPage = "menu"): void {
    if (this.upgrades) this.upgrades.visible = false;
    if (this.ownerPlayer) this.ownerPlayer.currentAction = "NONE";
    if (!this.menus) {
      this.menus = this.addPanel("menus", GameMenu);
      this.menus.onClose = this.closeModals;
      this.menus.ensureSetup();
      this.menus.onViewportChanged();
      this.invalidateLayout();
    }
    this.menus.open(page);
    this.invalidateState();
  }
  openUpgrades(tab: "upgrade-ui" | "prestige-ui"): void {
    if (this.menus) this.menus.visible = false;
    if (this.ownerPlayer) this.ownerPlayer.currentAction = "NONE";
    if (!this.upgrades) {
      this.upgrades = this.addPanel("upgrades", UpgradesModal);
      this.upgrades.onClose = this.closeModals;
      this.upgrades.ensureSetup();
      this.upgrades.onViewportChanged();
      this.invalidateLayout();
    }
    this.upgrades.visible = true;
    this.upgrades.currentTab = tab;
    this.upgrades.invalidate();
    this.invalidateState();
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
  refreshUpgrades(): void {
    this.upgrades?.invalidateState(); this.menus?.invalidateState();
    this.playerActionsUi?.invalidateState(); this.invalidateState();
  }
  override onRefresh(): void {
    const player = this.ownerPlayer;
    if (!player) return;
    this.score.text = formatGold(player.score) + (player.prestigePoints > 0 ? "\nPoints: " + formatGold(player.prestigePoints) : "");
    const reward = prestigeReward(player.currentPrestigeScore);
    this.ascend.text = "Ascend" + (reward ? " +" + formatGold(reward) : "");
    this.ascend.maxTextWidth = 92;
    this.ascend.accessibleName = "Ascend: Research and Prestige" + (reward ? ", " + formatGold(reward) + " prestige points available" : "");
    const action = getPlayerActions().find(action => action.code === player.currentAction);
    // The tooltip card describes the active tool; this line is only the first-run hint.
    this.context.text = (!action && !this.tutorial.active && !player.getData("actions.NEWROLLER") ? "Choose Dice, then tap an empty square" : "");
    const modalOpen = !!(this.menus?.visible || this.upgrades?.visible);
    this.tooltipCard.gold = player.score;
    this.tooltipCard.show(modalOpen ? null : this.tooltip);
    this.context.collapsed = !this.context.text;
    this.cancel.collapsed = player.currentAction === "NONE";
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
    // Bottom stack, top to bottom: tooltip card, docked tutorial card, status line, toolbar.
    const stackTop = this.context.collapsed ? this.playerActionsUi.top - 8 : this.context.top - 8;
    const header = Math.max(this.goldIcon.bottom, this.score.bottom, menu.bottom, this.ascend.bottom) + 10;
    this.tutorial.place(this.width, header, stackTop);
    this.toast.maxWidth = Math.min(420, this.width);
    this.toast.place(this.width / 2, Math.max(header, this.tutorial.dockedBottom + 8));
    this.tooltipCard.maxWidth = Math.min(360, this.width);
    this.tooltipCard.bottomCenter = ex.vec(this.width / 2, Math.min(stackTop, this.tutorial.dockedTop - 8) - 4);
    for (const modal of [this.upgrades, this.menus]) if (modal) modal.pos = this.size.scale(0.5);
  }
}
