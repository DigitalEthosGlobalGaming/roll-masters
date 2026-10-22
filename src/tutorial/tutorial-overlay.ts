import * as ex from "excalibur";
import { Level } from "@src/level";
import { Panel } from "@src/ui/panel";
import { Label } from "@src/ui/elements/label";
import { Button } from "@src/ui/elements/button";
import { Resources } from "@src/resources";
import { SoundManager } from "@src/sound-manager";
import { ease } from "@src/easing";
import { motionPreferences } from "@src/settings/motion-preferences";
import { TutorialDirector } from "./tutorial-director";
import type { TutorialChange } from "./tutorial-director";
import type { TutorialFacts, TutorialIcon, TutorialStep, TutorialTarget } from "./tutorial-steps";

const gold = ex.Color.fromHex("#e5c58a");
const success = ex.Color.fromHex("#8fd18a");
const ink = ex.Color.fromHex("#f2eadb");
const lamp = ex.Color.fromHex("#ffe08a");
/** Time the finished step stays on screen so completion is felt before the next appears. */
const celebrateMs = 320;

export type TutorialRect = { center: ex.Vector; size: ex.Vector };
export type TutorialLocator = (target: TutorialTarget) => TutorialRect | null;

/** Pulsing frame drawn over the control or board square the coach is pointing at. */
export class TutorialRing extends Panel {
  private readonly glow = new ex.Rectangle({ width: 1, height: 1, color: lamp });
  private readonly bars = [0, 1, 2, 3].map(() => new ex.Rectangle({ width: 1, height: 1, color: lamp }));
  private readonly glowMember = this.addGraphic(this.glow);
  private readonly barMembers = this.bars.map(bar => this.addGraphic(bar));
  private clock = 0;
  private lock = 1;
  /** Replay the "lock on" shrink; called whenever the target changes. */
  lockOn(): void { this.lock = motionPreferences.reduced ? 1 : 0; }
  override onSetup(): void { this.z = 30; }
  override onRender(): void {
    const w = this.width, h = this.height, t = 3;
    this.glow.width = w; this.glow.height = h;
    this.glowMember.offset = ex.vec(-w / 2, -h / 2);
    const [top, bottom, left, right] = this.bars;
    top.width = bottom.width = w; top.height = bottom.height = t;
    left.height = right.height = h; left.width = right.width = t;
    const offsets = [[-w / 2, -h / 2], [-w / 2, h / 2 - t], [-w / 2, -h / 2], [w / 2 - t, -h / 2]];
    this.barMembers.forEach((member, i) => { member.offset = ex.vec(offsets[i][0], offsets[i][1]); });
  }
  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    if (!this.rendered) return;
    const calm = motionPreferences.reduced;
    this.clock += elapsed;
    if (this.lock < 1) this.lock = Math.min(1, this.lock + elapsed / 260);
    const pulse = calm ? 0 : (Math.sin(this.clock / 260) + 1) / 2;
    const scale = (1 + 0.45 * (1 - ease("easeOutBack", this.lock))) * (1 + 0.05 * pulse);
    if (this.scale.x !== scale) this.scale = ex.vec(scale, scale);
    const strength = calm ? 1 : 0.7 + 0.3 * (1 - pulse);
    for (const bar of this.bars) bar.opacity = strength;
    this.glow.opacity = calm ? 0.16 : 0.08 + 0.12 * pulse;
  }
}

const iconSources = (): Record<TutorialIcon, ex.ImageSource> => ({
  dice: Resources.Dice6, pawn: Resources.ChessPawn, pieces: Resources.ChessKnight, gold: Resources.Dollar,
});

/** The coach panel: one lesson, its progress, and the only controls the tutorial needs. */
export class TutorialCard extends Panel {
  onNext: () => void = () => {};
  onSkip: () => void = () => {};
  private title!: Label;
  private message!: Label;
  private iconPanel!: Panel;
  private next!: Button;
  private skip!: Button;
  private readonly border = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#65583e") });
  private readonly surface = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#17201c") });
  private readonly track = new ex.Rectangle({ width: 1, height: 4, color: ex.Color.fromHex("#2a3a31") });
  private readonly fill = new ex.Rectangle({ width: 1, height: 4, color: gold });
  private readonly borderMember = this.addGraphic(this.border);
  private readonly surfaceMember = this.addGraphic(this.surface);
  private readonly trackMember = this.addGraphic(this.track);
  private readonly fillMember = this.addGraphic(this.fill);
  private sprites: Partial<Record<TutorialIcon, ex.Sprite>> = {};
  private shownIcon?: TutorialIcon;
  private _step: TutorialStep | null = null;
  private _available = 440;
  private ratio = 0;
  private targetRatio = 0;
  private enter = 1;
  private flashT = 1;

  set availableWidth(value: number) { value = Math.max(200, value); if (value !== this._available) { this._available = value; this.invalidate(); } }
  /** Fill the progress bar to this fraction, easing there. */
  setProgress(fraction: number): void { this.targetRatio = fraction; if (motionPreferences.reduced) this.ratio = fraction; }

  show(step: TutorialStep, index: number, total: number): void {
    this.ensureSetup();
    this._step = step;
    this.setProgress((index + 1) / total);
    this.flashT = 1;
    this.enter = motionPreferences.reduced ? 1 : 0;
    this.visible = true;
    this.invalidate();
  }
  hide(): void { this.ensureSetup(); this._step = null; this.visible = false; }
  /** Brief green flash + bump marking the lesson as done. */
  celebrate(): void { this.flashT = motionPreferences.reduced ? 1 : 0; this.edgeColor(this.flashT < 1); }

  override onSetup(): void {
    this.visible = false;
    this.z = 40;
    this.iconPanel = this.addPanel("icon", Panel); this.iconPanel.size = ex.vec(32, 32); this.iconPanel.z = 1;
    this.title = this.addPanel("title", Label); this.title.fontSize = 20; this.title.color = gold;
    this.message = this.addPanel("message", Label); this.message.fontSize = 16; this.message.color = ink;
    for (const label of [this.title, this.message]) { label.align = "left"; label.z = 1; }
    this.skip = this.addPanel("skip", Button); this.skip.text = "Skip"; this.skip.fontSize = 14; this.skip.quiet = true;
    this.skip.accessibleName = "Skip tutorial";
    this.skip.onClick = () => this.onSkip();
    this.next = this.addPanel("next", Button); this.next.fontSize = 16;
    this.next.onClick = () => this.onNext();
  }

  override onRefresh(): void {
    const step = this._step;
    this.title.text = step?.title ?? "";
    this.message.text = step?.text ?? "";
    this.next.collapsed = !step?.button;
    this.next.text = step?.button ?? "";
    this.accessibleName = step ? `${step.title}. ${step.text}` : "";
    this.shownIcon = undefined;
    this.iconPanel.collapsed = !step?.icon;
  }

  override onLayout(): void {
    const pad = 14, bar = 4;
    const width = Math.min(440, this._available);
    const icon = this._step?.icon ? 44 : 0;
    const textWidth = Math.max(60, width - pad * 2 - icon);
    this.title.maxWidth = textWidth;
    this.message.maxWidth = textWidth;
    const rowHeight = Math.max(this.skip.height, this.next.collapsed ? 0 : this.next.height);
    const height = bar + pad + Math.max(this.title.height + 6 + this.message.height, icon ? 32 : 0) + 12 + rowHeight + pad;
    this.size = ex.vec(width, height);
    const left = -this.halfWidth + pad;
    const top = -this.halfHeight + bar + pad;
    this.iconPanel.topLeft = ex.vec(left, top);
    this.title.topLeft = ex.vec(left + icon, top);
    this.message.topLeft = ex.vec(left + icon, this.title.bottom + 6);
    const rowY = this.halfHeight - pad - rowHeight / 2;
    this.skip.leftCenter = ex.vec(left, rowY);
    if (!this.next.collapsed) this.next.rightCenter = ex.vec(this.halfWidth - pad, rowY);
  }

  override onRender(): void {
    const w = this.width, h = this.height;
    this.border.width = w; this.border.height = h;
    this.surface.width = w - 2; this.surface.height = h - 2;
    this.track.width = w - 2;
    this.borderMember.offset = ex.vec(-w / 2, -h / 2);
    this.surfaceMember.offset = ex.vec(-w / 2 + 1, -h / 2 + 1);
    this.trackMember.offset = ex.vec(-w / 2 + 1, -h / 2 + 1);
    this.fillMember.offset = ex.vec(-w / 2 + 1, -h / 2 + 1);
    this.fill.width = Math.max(1, (w - 2) * this.ratio);
    const icon = this._step?.icon;
    if (icon && icon !== this.shownIcon) {
      this.shownIcon = icon;
      this.iconPanel.clearGraphics();
      const sprite = this.sprites[icon] ??= ex.Sprite.from(iconSources()[icon]);
      sprite.destSize = { width: 32, height: 32 };
      this.iconPanel.addGraphic(sprite, ex.vec(-16, -16));
    }
  }

  private edgeColor(on: boolean): void { this.fill.color = on ? success : gold; }

  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    if (!this.rendered) return;
    let scale = 1;
    if (this.enter < 1) {
      this.enter = Math.min(1, this.enter + elapsed / 220);
      scale *= 0.92 + 0.08 * ease("easeOutBack", this.enter);
    }
    if (this.flashT < 1) {
      this.flashT = Math.min(1, this.flashT + elapsed / celebrateMs);
      scale *= 1 + 0.035 * (1 - ease("easeOutCubic", this.flashT));
      if (this.flashT >= 1) this.edgeColor(false);
    }
    if (this.scale.x !== scale) this.scale = ex.vec(scale, scale);
    if (Math.abs(this.ratio - this.targetRatio) > 0.001) {
      this.ratio += (this.targetRatio - this.ratio) * Math.min(1, elapsed / 120);
      this.fill.width = Math.max(1, (this.width - 2) * this.ratio);
    }
  }
}

/**
 * Interactive first-run coach. Watches real game signals (never blocks input),
 * points at what to press, rewards each completed step, and saves its progress
 * in player data so a reload resumes where the player left off.
 */
export class TutorialOverlay extends Panel {
  readonly director = new TutorialDirector();
  /** Resolves a target to HUD-space geometry; supplied by the HUD that owns the controls. */
  locate: TutorialLocator = () => null;
  /** Shows a transient HUD notice. */
  notify: (text: string, kind?: "info" | "warning") => void = () => {};
  private card!: TutorialCard;
  private ring!: TutorialRing;
  private decided = false;
  private starting = false;
  private revealIn = 0;
  private get player() { return this.scene instanceof Level ? this.scene.player : undefined; }

  get active(): boolean { return this.director.running; }
  /** Top of the card when it is parked above the toolbar; Infinity otherwise. */
  get dockedTop(): number { return this.card.visible && this.docked ? this.card.top : Infinity; }
  private docked = false;
  /** Bottom of the card while it sits under the HUD header; 0 when hidden or docked low. */
  get dockedBottom(): number { return this.card.visible && !this.docked ? this.card.bottom : 0; }

  override onSetup(): void {
    this.ring = this.addPanel("ring", TutorialRing);
    this.card = this.addPanel("card", TutorialCard);
    this.ring.visible = false;
    this.card.onNext = () => { this.director.next(this.facts()); };
    this.card.onSkip = () => { this.director.skip(); };
    this.director.onChange = change => this.onChange(change);
    this.subscriptions.push(this.scene!.on("tutorial-signal", event => {
      if (this.director.running) this.director.signal(String(event), this.facts());
    }));
    this.subscriptions.push(this.scene!.on("ui-state-changed", () => {
      if (this.director.running) this.director.refresh(this.facts());
    }));
  }

  /** Start from the beginning (replay) or resume at a saved step. */
  begin(index = 0): void {
    const player = this.player;
    if (!player) return;
    this.starting = true;
    this.director.start(this.facts(), index);
    this.starting = false;
    if (index === 0) player.resetCamera?.();
    if (this.director.running) {
      player.setData("tutorial", this.director.index);
      this.grantGift(this.director.step);
    }
    this.revealIn = 0;
    this.present();
  }

  /** Called every frame until the game has loaded, then decides once whether to teach. */
  autoStart(): void {
    if (this.decided) return;
    const scene = this.scene, player = this.player;
    if (!(scene instanceof Level) || !player || !(scene as unknown as { gridSystem?: unknown }).gridSystem || scene.inputSystem?.paused !== false) return;
    this.decided = true;
    const saved = player.getData("tutorial");
    if (saved === "done" || saved === "skipped") return;
    if (typeof saved === "number") { this.begin(saved); return; }
    const veteran = player.totalPrestiges > 0 || !!player.getData("actions.NEWROLLER") || player.countBuildings("Dice") > 0;
    if (veteran) { player.setData("tutorial", "done"); return; }
    this.begin(0);
  }

  private facts(): TutorialFacts {
    const player = this.player;
    return {
      action: player?.currentAction ?? "NONE",
      dice: player?.countBuildings("Dice") ?? 0,
      pawns: player?.countBuildings("Pawn") ?? 0,
    };
  }

  private grantGift(step: TutorialStep | null): void {
    const player = this.player;
    if (step?.gift && player && player.score < step.gift) player.score = step.gift;
  }

  private onChange(change: TutorialChange): void {
    const player = this.player;
    if (change.type === "skipped") {
      player?.setData("tutorial", "skipped");
      this.revealIn = 0;
      this.present();
      this.notify("Tutorial skipped. Replay it from Menu.");
      return;
    }
    player?.setData("tutorial", change.type === "finished" ? "done" : change.to);
    if (change.type === "advanced") this.grantGift(this.director.steps[change.to]);
    if (this.starting) return;
    // Let the finished step land (flash, chime) before the next lesson appears.
    this.ring.visible = false;
    this.card.celebrate();
    SoundManager.play("ScoreSound");
    this.revealIn = motionPreferences.reduced ? 0 : celebrateMs;
    if (this.revealIn === 0) this.present();
  }

  private present(): void {
    const step = this.director.step;
    if (!step) {
      if (this.player) this.player.placementGuard = null;
      this.card.hide(); this.ring.visible = false; return;
    }
    this.card.show(step, this.director.index, this.director.total);
    const player = this.player;
    if (player) {
      const kind = step.target === "board:pawn-spot" ? "pawn-spot" : "spot";
      player.placementGuard = step.lockToTarget
        ? space => { const goal = player.tutorialTarget(kind); return !goal || space.globalPos.distance(goal) < 2; }
        : null;
    }
    // The frame loop shows (and locks on to) the ring once its target is on screen.
    this.ring.visible = false;
    this.invalidateLayout();
  }

  /** Park the card below the HUD header, or above the toolbar when it would cover the target. */
  place(width: number, top: number, bottom: number): void {
    this.card.availableWidth = width - 8;
    const target = this.director.step?.target;
    const rect = target ? this.locate(target) : null;
    const cardHeight = this.card.height;
    this.docked = !!rect && rect.center.y - rect.size.y / 2 < top + cardHeight + 16;
    this.card.topCenter = ex.vec(width / 2, this.docked ? bottom - cardHeight : top);
  }

  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    this.autoStart();
    if (this.revealIn > 0) {
      this.revealIn -= elapsed;
      if (this.revealIn <= 0) this.present();
    }
    const target = this.director.step?.target;
    if (!target || this.revealIn > 0) return;
    const rect = this.locate(target);
    if (this.ring.visible !== (rect !== null)) {
      this.ring.visible = rect !== null;
      if (rect) this.ring.lockOn();
    }
    if (!rect) return;
    const pad = 12;
    this.ring.size = ex.vec(rect.size.x + pad, rect.size.y + pad);
    if (!this.ring.pos.equals(rect.center)) this.ring.pos = rect.center.clone();
  }
}
