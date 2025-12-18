import { ExtendedKeyEvent } from "@src/input/extended-key-event";
import { DiceSaveSystem } from "@src/dice-save-system";
import { DiceGameGridSystem } from "@src/grid-system/grid-system-actor";
import { Level } from "@src/level";
import { Player } from "@src/player-systems/player";
import { Serializable } from "@src/systems/save-system";
import { NotificationSystem } from "@src/systems/notification.system";
import * as ex from "excalibur";

export class GameScene extends Level implements Serializable {
  static serializeName = "GameScene";
  serialize() {
    return null;
    // throw new Error("Method not implemented.");
  }

  previouslyLoaded: boolean = false;
  score: number = 0;
  best: number = 0;
  random = new ex.Random();
  gridSystem: DiceGameGridSystem | null = null;
  gridColor = new ex.Color(255 * 0, 255 * 0.1, 255 * 0.1, 1);
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
      this.save();
      this.engine.goToScene("WelcomeScene");
    }
  }

  deserialize(_data: any): void { }

  onPreDraw(ctx: ex.ExcaliburGraphicsContext, elapsed: number): void {
    const gridBounds = this.gridSystem?.getBounds();
    if (gridBounds == null) {
      return;
    }
    const position = gridBounds?.topLeft;
    const width = gridBounds?.width;
    const height = gridBounds?.height;

    const cameraTopLeft = this.camera.viewport.topLeft;

    ctx.drawRectangle(
      position.clone().sub(cameraTopLeft),
      width,
      height,
      this.gridColor
    );
    super.onPreDraw(ctx, elapsed);
  }

  prestige() {
    let player = this.player;
    if (player == null) {
      throw new Error("Player is not defined");
    }
    let prestigePoints = Math.floor(
      player.currentPrestigeScore / 1000000
    );
    player.currentPrestigeScore = 0;
    player.prestigePoints =
      Math.floor(player.prestigePoints + prestigePoints);

    player.totalPrestiges = Math.floor(player.totalPrestiges + 1);
    player.score = player.totalPrestiges * 100 + 10;
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