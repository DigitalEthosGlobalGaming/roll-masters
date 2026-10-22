import type { Upgrade } from "@src/components/upgrade-component";
import { Button } from "./elements/button";
import { Label } from "./elements/label";
import { Panel } from "./panel";
import { formatGold } from "./game-presentation";
import { buyMode } from "./buy-mode";
import * as ex from "excalibur";

export class UpgradeListItem extends Panel {
  onBuy: () => void = () => {};
  private _upgrade?: Upgrade;
  private buy!: Button;
  private title!: Label;
  private description!: Label;
  private readonly surface = new ex.Rectangle({ width: 1, height: 1, color: ex.Color.fromHex("#1d2020"), strokeColor: ex.Color.fromHex("#514736"), lineWidth: 1 });
  private surfaceMember?: { graphic: ex.Graphic; offset: ex.Vector };
  private _availableWidth = 400;
  get availableWidth(): number { return this._availableWidth; }
  set availableWidth(value: number) { if (value !== this._availableWidth) { this._availableWidth = value; this.invalidate(); } }
  get upgrade(): Upgrade | undefined { return this._upgrade; }
  set upgrade(value: Upgrade | undefined) { if (value !== this._upgrade) { this._upgrade = value; this.invalidate(); } }
  private get inline(): boolean { return this.availableWidth >= 500; }
  override onSetup(): void {
    this.surfaceMember = this.addGraphic(this.surface);
    this.buy = this.addPanel("buy", Button); this.buy.fontSize = 16;
    this.buy.onClick = () => { if (this.upgrade?.canResearch && this.upgrade.buy(buyMode.limit)) { this.upgrade.player.getScene().save(); this.onBuy(); } this.invalidate(); };
    this.title = this.addPanel("title", Label); this.title.fontSize = 20; this.title.align = "left"; this.title.color = ex.Color.fromHex("#e1c99d");
    this.description = this.addPanel("description", Label); this.description.fontSize = 16; this.description.align = "left"; this.description.color = ex.Color.fromHex("#c6c3b9");
  }
  override onRefresh(): void {
    const upgrade = this.upgrade;
    if (!upgrade) return;
    this.buy.maxTextWidth = Math.max(40, this.availableWidth - 64);
    this.title.text = upgrade.name + " · " + (upgrade.isMaxLevel ? "Complete" : "Lv " + upgrade.level);
    const replacements: Record<string, string> = { "{nextCost}": formatGold(upgrade.nextCost), "{nextValue}": String(upgrade.nextValue), "{cost}": formatGold(upgrade.cost), "{value}": String(upgrade.value) };
    let description = upgrade.description;
    for (const [key, value] of Object.entries(replacements)) description = description.replaceAll(key, value);
    this.description.text = description;
    const balance = upgrade.type === "RESEARCH" ? upgrade.player?.score ?? 0 : upgrade.player?.prestigePoints ?? 0;
    this.buy.collapsed = upgrade.isMaxLevel;
    const plan = upgrade.planPurchase(buyMode.limit, balance);
    const affordable = balance >= plan.cost;
    this.buy.disabled = !affordable || !upgrade.canResearch;
    const currency = upgrade.type === "RESEARCH" ? " gold" : plan.cost === 1 ? " point" : " points";
    const multiplier = buyMode.mode === "one" ? "" : " (x" + plan.count + ")";
    this.buy.text = (affordable ? "Upgrade" + multiplier + " · " : "Need ") + formatGold(plan.cost) + currency;
    this.buy.tooltip = { code: upgrade.code, title: this.title.text, description };
    const textWidth = this.availableWidth - 32 - (this.inline && !this.buy.collapsed ? this.buy.width + 20 : 0);
    this.title.maxWidth = Math.max(40, textWidth);
    this.description.maxWidth = Math.max(40, textWidth);
  }
  protected override measure(): ex.BoundingBox {
    const body = (this.title?.height ?? 0) + 8 + (this.description?.height ?? 0);
    const control = this.buy?.collapsed ? 0 : this.buy?.height ?? 0;
    return this.centeredSize(this.availableWidth, 28 + (this.inline ? Math.max(body, control) : body + (control ? control + 12 : 0)));
  }
  override onLayout(): void {
    this.title.pos = ex.vec(-this.halfWidth + 16 + this.title.halfWidth, -this.halfHeight + 14 + this.title.halfHeight);
    this.description.pos = ex.vec(-this.halfWidth + 16 + this.description.halfWidth, this.title.bottom + 8 + this.description.halfHeight);
    this.buy.pos = ex.vec(this.halfWidth - 16 - this.buy.halfWidth, this.inline ? 0 : this.halfHeight - 14 - this.buy.halfHeight);
  }
  override onRender(): void {
    if (this.surface.width !== this.width) this.surface.width = this.width;
    if (this.surface.height !== this.height) this.surface.height = this.height;
    if (this.surfaceMember) this.surfaceMember.offset = ex.vec(-this.halfWidth, -this.halfHeight);
  }
}
