import { DiceSaveSystem } from "@src/dice-save-system";
import { ExtendedKeyEvent } from "@src/input/extended-key-event";
import { Level } from "@src/level";
import { Player } from "@src/player-systems/player";
import { NotificationSystem } from "@src/systems/notification.system";
import { Serializable } from "@src/systems/save-system";
import * as ex from "excalibur";

export class GameScene extends Level implements Serializable {
  static serializeName = "GameScene";
  serialize() {
    return null;
    // throw new Error("Method not implemented.");
  }

  previouslyLoaded: boolean = false;

  random = new ex.Random();
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
    if (this.timer != null) {
      this.timer?.cancel();
      this.removeTimer(this.timer);
    }
  }

  postLoad(): void {
    this.player = this.entities.find((e) => {
      return e instanceof Player;
    });
    let timer = new ex.Timer({
      fcn: () => {
        this.preInitialise();

        if (this.player == null) {
          this.player = new Player();
          this.player.score = 10;
          this.add(this.player);
        }

        this.postInitialise();


        this.inputSystem.paused = false;
      },
      interval: 250,
    });
    timer = this.addTimer(timer);
    timer.start();
  }

  postInitialise() {

  }

  preInitialise() {

  }

  onKeyUp(evt: ExtendedKeyEvent) {
    if (evt.key == ex.Keys.Escape) {
      this.save();
      this.engine.goToScene("WelcomeScene");
    }
  }

  deserialize(_data: any): void { }
}
