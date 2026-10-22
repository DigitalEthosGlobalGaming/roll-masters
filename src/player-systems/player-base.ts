import { Building } from "@src/building";
import { Dice } from "@src/buildings/dice";
import {
  PlayerUpgradesComponent,
  upgrades,
} from "@src/components/player-upgrades-component";
import { ScoreComponent } from "@src/components/score-component";
import { Upgrade } from "@src/components/upgrade-component";
import { Environment } from "@src/env";
import { Ghost } from "@src/ghost";
import { GridSpace } from "@src/grid-system/grid-space";
import { ExtendedPointerEvent } from "@src/input/extended-pointer-event";
import { ButtonStates, InputHandler, InputManager } from "@src/input/input-manager";
import { GameScene } from "@src/scenes/game.scene";
import { PlayerUi } from "@src/ui/scores/player-ui";
import * as ex from "excalibur";
import {
  getPlayerActions,
  PlayerActions,
  PlayerActionTypes,
} from "./player-actions";
import { Tooltip } from "./player-tooltip";
import { clampCameraZoom, zoomAnchorOffset } from "./camera-controls";

type MouseState = {
  button: number;
  pos: ex.Vector;
  isDown: boolean;
  downPos: ex.Vector;
  downDelta: ex.Vector;
  pointer: ex.PointerAbstraction;
  dragging: boolean;
  downStartTick: number;
  downDuration: number;
};

type CameraMovementData = {
  isMoving: boolean;
  pos: ex.Vector;
  lastPos: ex.Vector;
};

export class PlayerBase extends ex.Actor implements InputHandler {
  collides(_vec: ex.Vector): boolean {
    return false;
  }
  acceptingInputs?: boolean | ButtonStates[] | undefined;
  scoreComponent!: ScoreComponent;
  playerUpgradesComponent!: PlayerUpgradesComponent;
  cameraPos = ex.vec(0, 0);
  pointerStates: { [key: number]: MouseState } = [];
  ghost!: Ghost;
  draggingBuilding: Building | null = null;
  playerUi!: PlayerUi;
  stats: { [key: string]: number } = {};

  _highlightedSpace: GridSpace | null = null;
  get highlightedSpace(): GridSpace | null {
    return this._highlightedSpace;
  }
  set highlightedSpace(space: GridSpace | null) {
    let oldSpace = this._highlightedSpace;
    if (space?.name == this._highlightedSpace?.name) {
      return;
    }
    this.onHighlightSpaceChange(oldSpace, space);
  }

  cameraMovementData: CameraMovementData | null = null;
  private pinchDistance = 0;
  private pinchCenter: ex.Vector | null = null;
  wishPosition = ex.vec(0, 0);
  isSetup = false;

  get inputSystem(): InputManager | null {
    return this.getScene()?.inputSystem ?? null
  }

  _currentAction: PlayerActions = "NONE";
  get currentAction() {
    return this._currentAction;
  }
  set currentAction(value: PlayerActions) {
    if (value == this._currentAction) {
      return;
    }
    this._currentAction = value;
    this.clearTooltips();
    this.playerUi.dirty = true;
    this.scene?.emit("ui-state-changed");
    let relatedAction = getPlayerActions().find((a) => a.code == value);
    if (relatedAction != null) {
      this.showTooltip({
        code: relatedAction.code,
        title: relatedAction.name,
        description: relatedAction.tooltip,
      });
    }
    this.getScene().save();
  }

  get totalPrestiges() {
    return this.getData("total-prestiges") ?? 0;
  }
  set totalPrestiges(value: number) {
    this.setData("total-prestiges", value);
  }
  get prestigePoints() {
    return this.getData("prestige-points") ?? 0;
  }
  set prestigePoints(value: number) {
    this.setData("prestige-points", value);
  }

  get currentPrestigeScore() {
    return this.getData("current-prestige-score") ?? 0;
  }
  set currentPrestigeScore(value: number) {
    this.setData("current-prestige-score", value);
  }


  _score: number = 0;

  get score() {
    return this?.scoreComponent?.score ?? this._score;
  }
  set score(value: number) {
    if (this.scoreComponent == null) {
      this._score = value;
      return;
    }
    this.scoreComponent.score = value;
  }

  subscriptions: ex.Subscription[] = [];

  getCamera(): ex.Camera {
    if (this.scene == null) {
      throw new Error("Scene is null");
    }
    return this.scene?.camera;
  }

  getScene(): GameScene {
    if (this.scene == null) {
      throw new Error("Scene is null");
    }
    if (!(this.scene instanceof GameScene)) {
      throw new Error("Scene is not a DiceGameScene");
    }
    return this.scene;
  }

  setup() {
    if (this.scene == null) {
      return;
    }
    if (this.isSetup) {
      return;
    }

    this.isSetup = true;
    if (this.ghost == null) {
      this.ghost = new Ghost();
      this.addChild(this.ghost);
    }

    if (this.playerUi == null) {
      this.playerUi = new PlayerUi();
      this.scene!.add(this.playerUi);
    }
    if (this.scoreComponent == null) {
      this.scoreComponent = new ScoreComponent();
      this.addComponent(this.scoreComponent);
      this.scoreComponent.score = this._score;
    }
    if (this.playerUpgradesComponent == null) {
      this.playerUpgradesComponent = new PlayerUpgradesComponent();
      this.addComponent(this.playerUpgradesComponent);
    }

    this.subscriptions.push(this.scene?.on("im-pointer-down", (e) => {
      this.onPointerDown(e as ExtendedPointerEvent);
    }));
    this.subscriptions.push(this.scene?.on("im-pointer-move", (e) => {
      this.onPointerMove(e as ExtendedPointerEvent);
    }));
    this.subscriptions.push(this.scene?.on("im-pointer-up", (e) => {
      this.onPointerUp(e as ExtendedPointerEvent);
    }));
    this.subscriptions.push(this.scene.on("im-wheel", (event) => {
      const e = event as { delta: number; screenPos: ex.Vector };
      this.setCameraZoom(this.getCamera().zoom * Math.exp(-Math.max(-200, Math.min(200, e.delta)) * 0.002), e.screenPos);
    }));
    const timer = this.scene?.addTimer(
      new ex.Timer({
        fcn: () => {
          const upgradeAmount = this.getUpgrade("PassiveEnergy")?.value ?? 1;
          const upgradeMultiplier = this.getUpgrade("BetterPassiverEnergy")?.value ?? 1;
          this.scoreComponent.updateScore(upgradeAmount * (upgradeMultiplier / 100));
        },
        interval: 1000,
        repeats: true,
      })
    );
    timer?.start();
  }

  onAdd(engine: ex.Engine): void {
    super.onAdd(engine);
    this.setup();
  }

  onPointerMove(e: ExtendedPointerEvent) {
    const pointers = this.inputSystem?.boardPointers ?? [];
    if (pointers.length > 1) {
      const center = pointers[0].add(pointers[1]).scale(0.5);
      const distance = pointers[0].distance(pointers[1]);
      if (this.pinchCenter && this.pinchDistance > 0 && distance > 0) {
        this.wishPosition = this.wishPosition.sub(center.sub(this.pinchCenter).scale(1 / this.getCamera().zoom));
        this.setCameraZoom(this.getCamera().zoom * distance / this.pinchDistance, center);
      }
      this.pinchCenter = center;
      this.pinchDistance = distance;
      return;
    }
    const isPrimary = e.isDown("MouseLeft") && this.inputSystem?.isDragging;

    if (isPrimary) {
      if (this.inputSystem?.isDown(ex.Keys.ShiftLeft)) {
        let space = this.getScene().gridSystem?.getSpaceFromWorldPosition(e.worldPos);
        if (space != null) {
          this.onSpaceClicked(space);
        }
      } else {
        if (this.cameraMovementData == null) {
          this.cameraMovementData = {
            isMoving: true,
            pos: e.screenPos.clone(),
            lastPos: e.screenPos.clone(),
          };
        } else {
          this.cameraMovementData.isMoving = true;
          this.cameraMovementData.pos = e.screenPos.clone();

          let diff = this.cameraMovementData.pos.sub(
            this.cameraMovementData.lastPos
          );
          this.wishPosition = this.wishPosition.sub(diff.scale(1 / this.getCamera().zoom));

          this.cameraMovementData.lastPos = e.screenPos.clone();
        }
      }
    } else if (!e.isDown("MouseLeft")) {
      this.cameraMovementData = null;
    }
  }

  onPointerDown(e: ExtendedPointerEvent) {
    this.cameraMovementData = { isMoving: false, pos: e.screenPos.clone(), lastPos: e.screenPos.clone() };
    const pointers = this.inputSystem?.boardPointers ?? [];
    if (pointers.length > 1) {
      this.pinchCenter = pointers[0].add(pointers[1]).scale(0.5);
      this.pinchDistance = pointers[0].distance(pointers[1]);
    }
  }

  onPointerUp(_e: ExtendedPointerEvent) {
    this.cameraMovementData = null;
    this.pinchCenter = null;
    this.pinchDistance = 0;
    const remaining = this.inputSystem?.boardPointers[0];
    if (remaining) this.cameraMovementData = { isMoving: true, pos: remaining.clone(), lastPos: remaining.clone() };
  }

  setCameraZoom(value: number, anchor?: ex.Vector): void {
    const camera = this.getCamera();
    const zoom = clampCameraZoom(value);
    const { width, height } = this.getEngine().screen.resolution;
    if (anchor) this.wishPosition = this.wishPosition.add(ex.vec(
      zoomAnchorOffset(anchor.x - width / 2, camera.zoom, zoom),
      zoomAnchorOffset(anchor.y - height / 2, camera.zoom, zoom)
    ));
    camera.zoom = zoom;
    this.playerUi?.onViewportChanged();
  }

  resetCamera(): void {
    this.setCameraZoom(1);
    this.wishPosition = this.getGridSystem()?.getBounds().center.clone() ?? ex.vec(0, 0);
  }

  onSpaceClicked(space: GridSpace) {
    if (!this.cameraMovementData?.isMoving) {
      if (this.currentAction === "NONE") {
        const building = space.children.find(item => item instanceof Building);
        building?.trigger();
        if (building?.tooltip) this.showTooltip({ code: "building-tooltip", title: building.friendlyName, description: building.tooltip });
        this.getScene().save();
        return;
      }
      let currentAction = getPlayerActions().find(
        (a) => a.code == this.currentAction
      );
      if (currentAction?.type == PlayerActionTypes.BUILDABLE) {
        if (this.currentAction == "REMOVE") {
          this.removeBuildable(space.globalPos);
        } else {
          this.placeBuildable(space.globalPos);
        }
      }
      this.getScene().save();
    }
  }

  getEngine(): ex.Engine {
    return this.getScene().engine;
  }

  getGridSystem() {
    const scene = this.getScene();
    return scene.gridSystem;
  }

  onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    const camera = this.getCamera();

    let targetPlayerPos = this.wishPosition;
    const bounds = this.getScene().gridSystem?.getBounds();
    if (bounds == null) {
      return;
    }

    if (targetPlayerPos.x < bounds.left) {
      targetPlayerPos.x = bounds.left;
    }
    if (targetPlayerPos.y < bounds.top) {
      targetPlayerPos.y = bounds.top;
    }
    if (targetPlayerPos.x > bounds.right) {
      targetPlayerPos.x = bounds.right;
    }
    if (targetPlayerPos.y > bounds.bottom) {
      targetPlayerPos.y = bounds.bottom;
    }

    if (!this.pos.equals(targetPlayerPos)) this.pos = targetPlayerPos.clone();
    if (!camera.pos.equals(targetPlayerPos)) camera.pos = targetPlayerPos.clone();
  }

  removeBuildable(worldPosition: ex.Vector) {
    const space =
      this.getScene().gridSystem?.getSpaceFromWorldPosition(worldPosition);
    if (space == null) {
      return;
    }
    let existingBuilding = space.children.find((c) => c instanceof Building);
    if (existingBuilding != null) {
      existingBuilding.kill();
    }
  }
  placeBuildable(worldPosition: ex.Vector) {
    const space =
      this.getScene().gridSystem?.getSpaceFromWorldPosition(worldPosition);
    if (space == null) {
      return;
    }
    let existingBuilding = space.children.find((c) => c instanceof Building);
    if (existingBuilding == null) {
      const action = getPlayerActions().find((a) => a.code == this.currentAction);
      let cost = 0;
      if (action?.type == PlayerActionTypes.BUILDABLE) {
        if (!action.unlocked) return;
        cost = action.building.cost();

        if (this.spendEnergy(cost)) {
          if (this.currentAction == "NEWDICE") {
            let newDice = new Dice();
            newDice.faces = 6;
            newDice.rollSpeed = 1;
            space.addChild(newDice);
            newDice.build();
          } else {
            if (action.building.classRef == null) {
              this.removeBuildable(space.globalPos);
            } else {
              const building = new action.building.classRef();
              space.addChild(building);
              building.build();
            }
          }
        } else {
          this.playerUi.notify("Not enough gold. Need " + cost.toLocaleString("en") + " gold.");
        }
      }
    } else {
      existingBuilding.trigger();
    }
  }

  tooltips: Tooltip[] = [];

  updateTooltip() {
    let ui = this.playerUi;
    let tooltip = this.tooltips?.[0] ?? null;
    if (tooltip != null) {
      ui.tooltip = tooltip;
      return;
    }

    let relatedAction = getPlayerActions().find((a) => a.code == this.currentAction);
    if (relatedAction != null) {
      ui.tooltip = {
        code: relatedAction.code,
        title: relatedAction.name,
        description: relatedAction.tooltip,
      };
    } else ui.tooltip = null;
  }

  clearTooltips() {
    this.tooltips = [];
    this.updateTooltip();
  }

  showTooltip(value: Tooltip) {
    if (this.tooltips.find((t) => t.code == value.code) != null) {
      return;
    }
    this.tooltips.unshift(value);
    this.updateTooltip();
  }

  hideTooltip(value: Tooltip | string) {
    let code = value;
    if (typeof value != "string") {
      code = value.code;
    }
    this.tooltips = this.tooltips.filter((t) => t.code != code);
    this.updateTooltip();
  }
  get upgrades(): Upgrade[] {
    return Object.values(this.playerUpgradesComponent.upgrades);
  }
  getUpgrade<T extends Upgrade>(t: keyof typeof upgrades): T | null {
    return this.playerUpgradesComponent?.getUpgrade(t);
  }

  spendEnergy(amount: number): boolean {
    if (Environment.isDev) {
      return true;
    }
    if (this.scoreComponent.score < amount) {
      return false;
    }
    this.scoreComponent.updateScore(-amount);
    return true;
  }

  spendPrestigePoints(amount: number): boolean {
    if (Environment.isDev) {
      return true;
    }
    let prestigePoints = this.prestigePoints;
    if (prestigePoints < amount) {
      return false;
    }
    this.prestigePoints = prestigePoints - amount;
    this.scoreComponent.renderScore();
    return true;
  }

  onHighlightSpaceChange(
    oldSpace: GridSpace | null,
    newSpace: GridSpace | null
  ) {
    let firstBuilding: Building | null = null;
    if (oldSpace != null) {
      const buildings = oldSpace.children.filter(
        (item) => item instanceof Building
      );
      for (let building of buildings) {
        building.wishScale = 1;
      }
    }
    if (newSpace != null) {
      const buildings = newSpace.children.filter(
        (item) => item instanceof Building
      );
      for (let building of buildings) {
        if (firstBuilding == null) {
          firstBuilding = building;
        }
        building.wishScale = 1.5;
      }
    }

    this.hideTooltip("building-tooltip");
    this._highlightedSpace = newSpace;
    if (firstBuilding != null) {
      let tooltip = firstBuilding.tooltip;
      if (tooltip != null) {
        let tooltipObject = {
          code: "building-tooltip",
          title: firstBuilding.friendlyName,
          description: tooltip,
        };
        this.showTooltip(tooltipObject);
      }
    }
  }

  data: { [key: string]: any } = {};
  setData(key: string, data: any) {
    if (this.data == null) {
      this.data = {};
    }
    const previous = this.data[key];
    this.data[key] = data;
    if (previous !== data && key !== "lifetime-energy") this.scene?.emit(key === "current-prestige-score" ? "ui-score-changed" : "ui-state-changed");
    if (key === "current-prestige-score" && Math.floor((previous ?? 0) / 1000000) !== Math.floor((data ?? 0) / 1000000)) this.playerUi?.refreshUpgrades();
    if (key === "prestige-points" && previous !== data) this.playerUi?.refreshUpgrades();
  }
  getData(key: string) {
    return this.data[key];
  }

  unlockAction(action: PlayerActions | string) {
    let playerAction = getPlayerActions().find((a) => a.code == action);
    if (playerAction == null) {
      return;
    }
    if (playerAction.unlocked == true) {
      return;
    }
    playerAction.unlocked = true;
    this.setData(`actions.${action}`, true);
    if (this.playerUi != null) {
      this.playerUi.playerActionsUi?.invalidate();
    }
  }
  unlockResearch(research: keyof typeof upgrades) {
    let upgrade = this.getUpgrade(research);
    if (upgrade != null) {
      upgrade.canResearch = true;
    } else {
      console.warn(`Could not find upgrade ${research}`);
    }

    this.setData(`research.${research}`, true);
    if (this.playerUi != null) {
      this.playerUi.refreshUpgrades();
    }
  }

  onPreKill(scene: ex.Scene): void {
    super.onPreKill(scene);
    this.playerUi?.kill();
    this.subscriptions.forEach((s) => s.close());
    this.subscriptions = [];
  }
}
