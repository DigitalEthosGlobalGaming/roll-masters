import { ExtendedKeyEvent } from "@src/input/extended-key-event";
import { DiceSaveSystem } from "@src/dice-save-system";
import { DiceGameGridSystem } from "@src/grid-system/grid-system-actor";
import { Level } from "@src/level";
import { Player } from "@src/player-systems/player";
import { Serializable } from "@src/systems/save-system";
import { NotificationSystem } from "@src/systems/notification.system";
import * as ex from "excalibur";
import { prestigeReward } from "@src/ui/game-presentation";
import { getPlayerActions } from "@src/player-systems/player-actions";

const boardColors = {
  shadow: ex.Color.fromHex("#0b0d0e"),
  frame: ex.Color.fromHex("#362e26"),
  rim: ex.Color.fromHex("#86704b"),
  inset: ex.Color.fromHex("#111c19"),
  alternate: ex.Color.fromHex("#253c34"),
};

export class GameScene extends Level implements Serializable {
  static serializeName = "GameScene";
  serialize() {
    return null;
    // throw new Error("Method not implemented.");
  }

  previouslyLoaded: boolean = false;
  openPrestigeOnLoad = false;
  lastPrestige?: { points: number; balance: number; gold: number };
  score: number = 0;
  best: number = 0;
  random = new ex.Random();
  gridSystem: DiceGameGridSystem | null = null;
  gridColor = ex.Color.fromHex("#20352e");
  saveSystem!: DiceSaveSystem;
  notificationSystem!: NotificationSystem;
  autosaveTimer: ex.Timer | null = null;
  timer: ex.Timer | null = null;

  override onInitialize(engine: ex.Engine): void {
    super.onInitialize(engine);
    if (this.notificationSystem == null) {
      this.notificationSystem = new NotificationSystem();
      this.world.add(this.notificationSystem);
    }
  }

  override onActivate(ctx: ex.SceneActivationContext): void {
    super.onActivate(ctx);
    this.inputSystem.paused = true;
    if (!this.previouslyLoaded) {
      this.previouslyLoaded = true;
      if (this.saveSystem == null) {
        this.saveSystem = new DiceSaveSystem();
        this.saveSystem.addClassMapping(GameScene);
      }
      this.addTimer(
        new ex.Timer({
          fcn: () => {
            this.load();
          },
          interval: 250,
        })
      ).start();
    } else {
      this.postLoad();
    }
  }

  save() {
    try {
      this.saveSystem?.save(this);
    } catch (e) {
      console.error(e);
    }
  }
  load() {
    this.preLoad();
    this.saveSystem?.load(this);
    this.postLoad();
    if (this.autosaveTimer == null) {
      this.autosaveTimer = new ex.Timer({
        fcn: () => {
          if (this.isCurrentScene()) {
            this.save();
          }
        },
        interval: 1000 * 30,
        repeats: true,
      });
      this.addTimer(this.autosaveTimer);
      this.autosaveTimer.start();
    }
  }

  preLoad(): void {
    this?.player?.kill();
    this?.gridSystem?.kill();
    if (this.timer != null) {
      this.timer?.cancel();
      this.removeTimer(this.timer);
    }
  }

  postLoad(): void {
    this.player = this.entities.find((e) => {
      return e instanceof Player;
    });
    let gridSystem = this.entities.find((e) => {
      return e instanceof DiceGameGridSystem;
    });
    if (gridSystem != null) {
      this.gridSystem = gridSystem;
    }
    let timer = new ex.Timer({
      fcn: () => {
        if (this.gridSystem == null) {
          this.gridSystem = new DiceGameGridSystem();
          this.add(this.gridSystem);
        }
        this.gridSystem.size = new ex.Vector(32, 32);
        this.gridSystem.spaceSize = new ex.Vector(32, 32);

        if (this.player == null) {
          this.player = new Player();
          this.player.score = 10;
          this.add(this.player);
          const gridSize = this.gridSystem.getBounds().center;
          this.player.wishPosition = gridSize.clone();
        }
        this.resizeGrid();

        this.inputSystem.paused = false;
        if (this.openPrestigeOnLoad) {
          this.openPrestigeOnLoad = false;
          this.player?.playerUi.openUpgrades("prestige-ui");
        }
      },
      interval: 250,
    });
    timer = this.addTimer(timer);
    timer.start();
  }

  resizeGrid() {
    if (this.gridSystem == null) {
      return;
    }
    const defaultSize = 16;
    const gridSize = this.player?.getUpgrade("GridSize")?.value ?? 0;
    this.gridSystem.size = new ex.Vector(
      gridSize + defaultSize,
      gridSize + defaultSize
    );
  }

  onKeyUp(evt: ExtendedKeyEvent) {
    if (evt.key == ex.Keys.Escape) {
      if (this.player?.currentAction !== "NONE" && this.player) this.player.currentAction = "NONE";
      else this.player?.playerUi.openMenu();
    }
  }

  deserialize(_data: any): void { }

  onPreDraw(ctx: ex.ExcaliburGraphicsContext, elapsed: number): void {
    super.onPreDraw(ctx, elapsed);
    const gridBounds = this.gridSystem?.getBounds();
    if (gridBounds == null) {
      return;
    }
    const position = gridBounds?.topLeft;
    const width = gridBounds?.width;
    const height = gridBounds?.height;

    const screenPosition = this.engine.worldToScreenCoordinates(position);
    const zoom = this.camera.zoom;
    const boardWidth = width * zoom;
    const boardHeight = height * zoom;

    // Draw the tabletop in the same screen space as the board so its frame
    // follows camera movement and zoom without changing placement bounds.
    const surround = (padding: number, color: ex.Color, offset = 0) => {
      ctx.drawRectangle(
        screenPosition.add(ex.vec((offset - padding) * zoom, (offset - padding) * zoom)),
        boardWidth + padding * 2 * zoom,
        boardHeight + padding * 2 * zoom,
        color
      );
    };
    surround(13, boardColors.shadow, 5);
    surround(11, boardColors.rim);
    surround(10, boardColors.frame);
    surround(3, boardColors.rim);
    surround(2, boardColors.inset);

    ctx.drawRectangle(
      screenPosition,
      boardWidth,
      boardHeight,
      this.gridColor
    );
    const grid = this.gridSystem!;
    const cellWidth = grid.spaceSize.x * zoom;
    const cellHeight = grid.spaceSize.y * zoom;
    for (let row = 0; row < grid.size.y; row++) {
      for (let col = row % 2; col < grid.size.x; col += 2) {
        ctx.drawRectangle(
          screenPosition.add(ex.vec(col * cellWidth, row * cellHeight)),
          cellWidth,
          cellHeight,
          boardColors.alternate
        );
      }
    }
  }

  prestige() {
    let player = this.player;
    if (player == null) {
      throw new Error("Player is not defined");
    }
    const prestigePoints = prestigeReward(player.currentPrestigeScore);
    if (prestigePoints < 1) return;
    player.currentPrestigeScore = 0;
    player.prestigePoints =
      Math.floor(player.prestigePoints + prestigePoints);

    player.totalPrestiges = Math.floor(player.totalPrestiges + 1);
    player.score = player.totalPrestiges * 100 + 10;
    this.lastPrestige = { points: prestigePoints, balance: player.prestigePoints, gold: player.score };
    for (const action of getPlayerActions()) action.unlocked = ["NEWDICE", "REMOVE", "UPGRADES"].includes(action.code);
    for (const i in player.data) {
      if (i.startsWith("actions.")) {
        player.data[i] = false;
      }
      if (i.startsWith("research.")) {
        player.data[i] = false;
      }
    }
    for (const i in player.upgrades) {
      const upgrade = player.upgrades[i];
      if (upgrade.type == "RESEARCH") {
        player.upgrades[i].level = 0;
      }
    }

    this.gridSystem?.clearAll();
    this.gridSystem?.kill();
    this.save();
    player.kill();
    this.player = undefined;
    this.gridSystem = null;
    this.previouslyLoaded = false;
    this.engine.goToScene("PrestigeScene");
  }
}
