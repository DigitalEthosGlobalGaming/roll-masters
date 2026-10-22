import * as ex from "excalibur";
import { Panel } from "./panel";
import { Label } from "./elements/label";
import { ease } from "@src/easing";
import { motionPreferences } from "@src/settings/motion-preferences";

export type ToastKind = "info" | "warning";

const palette = {
  info: { accent: ex.Color.fromHex("#e5c58a"), mark: "i" },
  warning: { accent: ex.Color.fromHex("#f0907c"), mark: "!" },
};
const ink = ex.Color.fromHex("#f2eadb");
const dropMs = 220;
const shakeMs = 300;
const leaveMs = 100;
const lifeMs = 2800;

/**
 * Transient alert near the top of the HUD. Warnings drop in and give a short
 * decaying shake, repeated taps re-trigger it, and it clears itself. The kind
 * is carried by a mark and wording as well as colour, and nothing needs input.
 */
export class Toast extends Panel {
  private mark!: Label;
  private message!: Label;
  private readonly border = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#65583e") });
  private readonly surface = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#17201c") });
  private readonly badge = new ex.Rectangle({ width: 28, height: 1, color: palette.info.accent });
  private readonly borderMember = this.addGraphic(this.border);
  private readonly surfaceMember = this.addGraphic(this.surface);
  private readonly badgeMember = this.addGraphic(this.badge);
  private text = "";
  private kind: ToastKind = "info";
  private _maxWidth = 420;
  private enter = 1;
  private shake = 1;
  private life = 0;
  private leaving = 0;
  private base: ex.Vector | null = null;

  set maxWidth(value: number) { value = Math.max(160, value); if (value !== this._maxWidth) { this._maxWidth = value; this.invalidate(); } }
  get showing(): boolean { return this.visible; }

  show(text: string, kind: ToastKind = "info"): void {
    // The HUD may notify before this child has set up; setup would otherwise re-hide it.
    this.ensureSetup();
    const calm = motionPreferences.reduced;
    const repeat = this.visible && !this.leaving && text === this.text && kind === this.kind;
    this.text = text; this.kind = kind;
    this.life = lifeMs; this.leaving = 0;
    this.shake = kind === "warning" && !calm ? 0 : 1;
    if (!repeat) this.enter = calm ? 1 : 0;
    this.visible = true;
    this.invalidate();
  }

  override onSetup(): void {
    this.visible = false;
    this.z = 60;
    this.mark = this.addPanel("mark", Label); this.mark.fontSize = 18; this.mark.z = 1;
    this.message = this.addPanel("message", Label); this.message.fontSize = 15; this.message.color = ink;
    this.message.align = "left"; this.message.z = 1;
  }

  override onRefresh(): void {
    const style = palette[this.kind];
    this.mark.text = style.mark;
    this.mark.color = ex.Color.fromHex("#17201c");
    this.message.text = this.text;
    this.badge.color = style.accent;
    this.accessibleName = this.text;
  }

  override onLayout(): void {
    const pad = 10, badge = 28, gap = 10;
    this.message.maxWidth = this._maxWidth - pad * 2 - badge - gap;
    const height = Math.max(badge, this.message.height) + pad * 2;
    this.size = ex.vec(badge + gap + this.message.width + pad * 2, height);
    this.badge.height = height - 2;
    this.mark.center = ex.vec(-this.halfWidth + 1 + badge / 2, 0);
    this.message.leftCenter = ex.vec(-this.halfWidth + pad + badge + gap, 0);
  }

  override onRender(): void {
    const w = this.width, h = this.height;
    this.border.width = w; this.border.height = h;
    this.surface.width = w - 2; this.surface.height = h - 2;
    this.borderMember.offset = ex.vec(-w / 2, -h / 2);
    this.surfaceMember.offset = ex.vec(-w / 2 + 1, -h / 2 + 1);
    this.badgeMember.offset = ex.vec(-w / 2 + 1, -h / 2 + 1);
  }

  /** Park the toast with its top edge centred at x; motion offsets are layered on afterwards. */
  place(x: number, top: number): void {
    // Computed directly: nothing depends on our position, and the usual position
    // setters would re-invalidate the HUD layout on float round-off every pass.
    const bounds = this.localBounds;
    this.base = ex.vec(x - bounds.center.x, top - bounds.top);
    this.applyMotion();
  }

  private applyMotion(): void {
    if (!this.base) return;
    const drop = this.enter < 1 ? -16 * (1 - ease("easeOutBack", this.enter)) : 0;
    const wobble = this.shake < 1 ? Math.sin(this.shake * 38) * 7 * Math.pow(1 - this.shake, 2) : 0;
    // Direct vector writes: motion must not invalidate the layout that positions us.
    this.pos = ex.vec(this.base.x + wobble, this.base.y + drop);
    const scale = this.leaving > 0 ? 1 - 0.1 * ease("easeOutCubic", Math.min(1, this.leaving / leaveMs)) : 1;
    if (this.scale.x !== scale) this.scale = ex.vec(scale, scale);
  }

  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    if (!this.visible) return;
    if (this.enter < 1) this.enter = Math.min(1, this.enter + elapsed / dropMs);
    if (this.shake < 1) this.shake = Math.min(1, this.shake + elapsed / shakeMs);
    if (this.leaving > 0) {
      this.leaving += elapsed;
      if (this.leaving >= leaveMs) { this.leaving = 0; this.visible = false; this.scale = ex.vec(1, 1); return; }
    } else {
      this.life -= elapsed;
      if (this.life <= 0) {
        if (motionPreferences.reduced) this.visible = false; else this.leaving = 1;
      }
    }
    this.applyMotion();
  }
}
