import * as ex from "excalibur";
import { FloatingScore } from "@src/ui/scores/floating-score";
import { BaseComponent } from "./base-component";
import { Player } from "@src/player-systems/player";

export class ScoreComponent extends BaseComponent {
  private _score: number;
  private _previousScore: number = -10;
  private _previousPrestigePoints: number = -10;
  private _scorePerMinute: number = 0;
  private lastScores: number[] = [];
  private scoreLabel: ex.Label | null = null;

  timer: ex.Timer | null = null;
  lastTimerRan: number = 0;

  constructor() {
    super();
    this._score = 0;
  }

  onAdd(owner: ex.Entity): void {
    super.onAdd?.(owner);
    if (owner instanceof Player) {
      this.renderScore();
      this.score = owner._score;
      if (this.timer == null) {
        this.timer = new ex.Timer({
          action: () => {
            this.renderScore();
          },
          interval: 100,
          repeats: true,
        });
        owner.scene?.addTimer(this.timer);
        this.timer.start();
      }
    }
  }

  get scorePerMinute(): number {
    return this._scorePerMinute;
  }

  public get score(): number {
    return this._score;
  }

  public set score(value: number) {
    this._score = Math.floor(value);
  }

  renderScore() {
    let player = this.player;
    if (player == null) {
      return;
    }
    if (
      this._previousScore == this._score &&
      player.prestigePoints == this._previousPrestigePoints
    ) {
      return;
    }

    let now = Date.now();
    if (
      this.lastTimerRan != 0 &&
      this._previousScore > 0 &&
      this._previousScore < this._score
    ) {
      let current = Math.floor(now / 1000 / 5) % 3;
      let old = current - 1;
      if (old < 0) {
        old = 2;
      }
      this.lastScores[current] = this._score;
      let scoreDiff = this._score - this._previousScore;
      let newScorePerMinute = scoreDiff;
      let scorePerMinuteDiff = newScorePerMinute - this._scorePerMinute;
      if (this._scorePerMinute == 0) {
        this._scorePerMinute = newScorePerMinute;
      } else {
        let percentageChange = Math.abs(
          scorePerMinuteDiff / this._scorePerMinute
        );
        if (percentageChange > 0.1) {
          scorePerMinuteDiff = scorePerMinuteDiff * 0.05;
          this._scorePerMinute += scorePerMinuteDiff;
        }
        this._scorePerMinute += scorePerMinuteDiff;
      }
      this._scorePerMinute = Math.round(this._scorePerMinute);
    }
    this.lastTimerRan = now;
    if (this.scoreLabel == null) {
      this.scoreLabel = new ex.Label({
        text: `Gold: ${this._score}`,
        pos: new ex.Vector(10, 10),
        font: new ex.Font({
          family: "ds-digi",
          size: 24,
          color: ex.Color.White,
        }),
      });
    }
    if (this.scoreLabel.parent == null) {
      const ui = this.playerUi;
      ui.addChild(this.scoreLabel);
    }
    this._previousScore = this._score;
    const prestigePoints = player.prestigePoints;
    let text = `Gold: ${Math.floor(this._score)}\u23E2`;
    // if (this._scorePerMinute > 0) {
    //   text += `\n${this._scorePerMinute}\u23E2/min`;
    // }
    if (prestigePoints > 0) {
      text += `\n${prestigePoints}⏣`;
    }
    this.scoreLabel.text = text;
  }

  public updateScore(points: number) {
    this.score += points;
    const key = "current-prestige-score";
    let scoreThisPrestige = this.player?.getData(key) ?? 0;
    this.player?.setData(key, scoreThisPrestige + points);

    this.player?.setData(
      "lifetime-energy",
      (this.player.getData("lifetime-energy") ?? 0) + points
    );
  }

  public createScore(creator: ex.Actor, value: number) {
    if (this.owner == null) {
      throw new Error("Owner is null");
    }
    const engine = this.owner.scene?.engine;
    if (!engine) return;

    const fps = engine.stats.currFrame.fps ?? 60;
    const maxInstances = Math.max(5, Math.floor(fps / 2));
    const numberOfInstances = Math.min(50, maxInstances);

    if (
      FloatingScore.numberOfInstances >= numberOfInstances ||
      this.scoreLabel == null
    ) {
      this.updateScore(value);
      return;
    }

    const pos = creator.globalPos;
    const floatingScore = new FloatingScore(pos, this.scoreLabel.globalPos);
    this.owner.scene?.engine.add(floatingScore);

    FloatingScore.numberOfInstances += 1;
    floatingScore.addScore(value).then((value) => {
      this.updateScore(value);
      FloatingScore.numberOfInstances -= 1;
    });
  }
}
