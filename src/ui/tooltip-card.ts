import * as ex from "excalibur";
import { Panel } from "./panel";
import { Label } from "./elements/label";
import { formatGold } from "./game-presentation";
import { ease } from "@src/easing";
import { Resources } from "@src/resources";
import { motionPreferences } from "@src/settings/motion-preferences";
import type { Tooltip } from "@src/player-systems/player-tooltip";

const gold = ex.Color.fromHex("#e5c58a");
const warning = ex.Color.fromHex("#f0907c");
const ink = ex.Color.fromHex("#f2eadb");
const popMs = 170;
const leaveMs = 90;

/**
 * Compact info card shown for the tool, piece or button the player is considering.
 * It sits above the toolbar (never under a finger), names the gold cost in text
 * as well as colour, and pops in/out unless motion is reduced.
 */
export class TooltipCard extends Panel {
  private title!: Label;
  private cost!: Label;
  private coin!: Panel;
  private message!: Label;
  private shortfall!: Label;
  private readonly border = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#65583e") });
  private readonly surface = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#17201c") });
  private readonly edge = new ex.Rectangle({ width: 3, height: 1, color: gold });
  private readonly borderMember = this.addGraphic(this.border);
  private readonly surfaceMember = this.addGraphic(this.surface);
  private readonly edgeMember = this.addGraphic(this.edge);
  private _tooltip: Tooltip | null = null;
  private _gold = Infinity;
  private _maxWidth = 360;
  private progress = 1;
  private leaving = false;

  get tooltip(): Tooltip | null { return this._tooltip; }
  /** Available width for the card; the card shrinks to its content below this. */
  set maxWidth(value: number) { value = Math.max(120, value); if (value !== this._maxWidth) { this._maxWidth = value; this.invalidate(); } }
  /** Player gold, so an unaffordable cost can be flagged. */
  set gold(value: number) { if (value !== this._gold) { this._gold = value; this.invalidateState(); } }

  show(value: Tooltip | null): void {
    // The HUD refreshes before its children set up; setup would otherwise re-hide the card.
    this.ensureSetup();
    if (value === null) {
      if (!this._tooltip || this.leaving) return;
      this.leaving = true;
      this.progress = 0;
      if (motionPreferences.reduced) this.finishLeave();
      return;
    }
    const same = this._tooltip?.code === value.code && this._tooltip.title === value.title
      && this._tooltip.description === value.description && this._tooltip.cost === value.cost;
    const wasHidden = !this.visible || this.leaving;
    this._tooltip = value;
    this.leaving = false;
    if (same && !wasHidden) return;
    this.visible = true;
    this.progress = motionPreferences.reduced ? 1 : 0;
    this.applyScale();
    this.invalidate();
  }

  private finishLeave(): void {
    this.leaving = false;
    this._tooltip = null;
    this.visible = false;
    this.scale = ex.vec(1, 1);
  }

  override onSetup(): void {
    this.visible = false;
    this.z = 50;
    this.title = this.addPanel("title", Label); this.title.fontSize = 17; this.title.color = gold;
    this.cost = this.addPanel("cost", Label); this.cost.fontSize = 16;
    // The coin is drawn here rather than via the label's inline currency marker.
    this.coin = this.addPanel("coin", Panel); this.coin.size = ex.vec(18, 18); this.coin.z = 1;
    const sprite = ex.Sprite.from(Resources.Dollar);
    sprite.destSize = { width: 18, height: 18 };
    this.coin.addGraphic(sprite, ex.vec(-9, -9));
    this.message = this.addPanel("message", Label); this.message.fontSize = 14; this.message.color = ink;
    this.shortfall = this.addPanel("shortfall", Label); this.shortfall.fontSize = 13; this.shortfall.color = warning;
    for (const label of [this.title, this.message, this.shortfall]) label.align = "left";
    this.cost.align = "right";
    for (const label of [this.title, this.cost, this.message, this.shortfall]) label.z = 1;
  }

  override onRefresh(): void {
    const tip = this._tooltip;
    this.title.text = tip?.title ?? "";
    this.message.text = tip?.description ?? "";
    const affordable = tip?.cost === undefined || this._gold >= tip.cost;
    this.cost.collapsed = tip?.cost === undefined;
    this.cost.text = tip?.cost === undefined ? "" : `${formatGold(tip.cost)}`;
    this.coin.collapsed = this.cost.collapsed;
    this.cost.color = affordable ? gold : warning;
    this.shortfall.collapsed = affordable;
    this.shortfall.text = affordable || !tip?.cost ? "" : `Need ${formatGold(tip.cost - this._gold)} more gold`;
    this.message.collapsed = !this.message.text;
    this.accessibleName = tip ? `${tip.title}. ${tip.description}` : "";
  }

  override onLayout(): void {
    const pad = 12, edge = 3, gap = 4;
    const inner = this._maxWidth - pad * 2 - edge;
    const costWidth = this.cost.collapsed ? 0 : this.cost.width + this.coin.width + 4;
    this.title.maxWidth = Math.max(40, inner - (costWidth ? costWidth + 10 : 0));
    this.message.maxWidth = inner;
    this.shortfall.maxWidth = inner;
    const header = this.title.width + (costWidth ? costWidth + 10 : 0);
    const content = Math.max(header, this.message.collapsed ? 0 : this.message.width, this.shortfall.collapsed ? 0 : this.shortfall.width);
    const width = Math.min(this._maxWidth, Math.max(150, content + pad * 2 + edge));
    const headerHeight = Math.max(this.title.height, this.cost.collapsed ? 0 : this.cost.height);
    let height = pad * 2 + headerHeight;
    if (!this.message.collapsed) height += gap + this.message.height;
    if (!this.shortfall.collapsed) height += gap + this.shortfall.height;
    this.size = ex.vec(width, height);
    const left = -this.halfWidth + pad + edge;
    let top = -this.halfHeight + pad;
    this.title.leftCenter = ex.vec(left, top + headerHeight / 2);
    this.coin.rightCenter = ex.vec(this.halfWidth - pad, top + headerHeight / 2);
    this.cost.rightCenter = ex.vec(this.coin.left - 4, top + headerHeight / 2);
    top += headerHeight + gap;
    if (!this.message.collapsed) { this.message.topLeft = ex.vec(left, top); top += this.message.height + gap; }
    if (!this.shortfall.collapsed) this.shortfall.topLeft = ex.vec(left, top);
  }

  override onRender(): void {
    const w = this.width, h = this.height;
    this.border.width = w; this.border.height = h;
    this.surface.width = w - 2; this.surface.height = h - 2;
    this.edge.height = h - 2;
    this.borderMember.offset = ex.vec(-w / 2, -h / 2);
    this.surfaceMember.offset = ex.vec(-w / 2 + 1, -h / 2 + 1);
    this.edgeMember.offset = ex.vec(-w / 2 + 1, -h / 2 + 1);
  }

  private applyScale(): void {
    // Pop in with a small overshoot; shrink away quickly on exit.
    const t = Math.min(1, this.progress);
    const scale = this.leaving ? 1 - 0.08 * ease("easeOutCubic", t) : 0.88 + 0.12 * ease("easeOutBack", t);
    if (this.scale.x !== scale) this.scale = ex.vec(scale, scale);
  }

  override onPreUpdate(engine: ex.Engine, elapsed: number): void {
    super.onPreUpdate(engine, elapsed);
    if (this.progress >= 1 && !this.leaving) return;
    this.progress += elapsed / (this.leaving ? leaveMs : popMs);
    if (this.leaving && this.progress >= 1) { this.finishLeave(); return; }
    this.applyScale();
  }
}
