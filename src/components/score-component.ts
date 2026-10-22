import * as ex from "excalibur";
import { FloatingScore } from "@src/ui/scores/floating-score";
import { BaseComponent } from "./base-component";
import { Environment } from "@src/env";
import { motionPreferences } from "@src/settings/motion-preferences";

/** Currency is committed before visual feedback; animation never owns game state. */
export class ScoreComponent extends BaseComponent {
  private _score = 0;
  get scorePerMinute(): number { return 0; }
  get score(): number { return this._score; }
  set score(value: number) {
    const next = Math.floor(value);
    if (next === this._score) return;
    this._score = next;
    this.renderScore();
  }
  renderScore(): void { this.owner?.scene?.emit("ui-score-changed"); }
  updateScore(points: number): void {
    this.score += points;
    if (points > 0) {
      const player = this.player;
      player?.setData("current-prestige-score", (player.getData("current-prestige-score") ?? 0) + points);
      player?.setData("lifetime-energy", (player.getData("lifetime-energy") ?? 0) + points);
    }
  }
  createScore(creator: ex.Actor, value: number): void {
    if (!this.owner) throw new Error("Owner is null");
    this.updateScore(value);
    const engine = this.owner.scene?.engine;
    const target = this.playerUi.getPanel("score");
    if (!engine || !target || Environment.get("hide-floating-gold") || motionPreferences.reduced) return;
    const maxInstances = Math.max(5, Math.floor((engine.stats.currFrame.fps ?? 60) / 2));
    if (FloatingScore.numberOfInstances >= Math.min(50, maxInstances)) return;
    const destination = engine.screenToWorldCoordinates(target.globalPos);
    const floatingScore = new FloatingScore(creator.globalPos, destination);
    this.owner.scene!.add(floatingScore);
    FloatingScore.numberOfInstances += 1;
    void floatingScore.addScore(value).finally(() => { FloatingScore.numberOfInstances -= 1; });
  }
}
