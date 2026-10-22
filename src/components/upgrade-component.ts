import { ImageSource } from "excalibur";
import { Player } from "../player-systems/player";
import { Resources } from "../resources";
import { growthFunctions, GrowthType } from "../utility/big-o-calculations";

export const UpgradeTypes = {
  "RESEARCH": "RESEARCH",
  "PRESTIGE": "PRESTIGE",
}
export type UpgradeType = keyof typeof UpgradeTypes;
export class Upgrade {
  type: UpgradeType = "RESEARCH";
  protected _baseCost: number = 0;
  get baseCost() {
    return this._baseCost;
  }
  set baseCost(value: number) {
    if (this._baseCost == value) {
      return;
    }
    this._baseCost = value;
    this.calculate();
  }

  protected _maxLevel: number = -1;
  get maxLevel() {
    return this._maxLevel;
  }
  set maxLevel(value: number) {
    if (this._maxLevel == value) {
      return;
    }
    this._maxLevel = value;
    this.calculate();
  }

  get isMaxLevel() {
    if (this.maxLevel == -1) {
      return false;
    }
    return this.level >= this.maxLevel;
  }
  protected _baseValue: number = 0;
  get baseValue() {
    return this._baseValue;
  }
  set baseValue(value: number) {
    if (this.baseValue == value) {
      return;
    }
    this._baseValue = value;
    this.calculate();
  }

  protected _costType: GrowthType = GrowthType.LINEAR;
  get costType() {
    return this._costType;
  }
  set costType(value: GrowthType) {
    if (this._costType == value) {
      return;
    }
    this._costType = value;
    this.calculate();
  }

  protected _bonusType: GrowthType = GrowthType.LINEAR;
  get bonusType() {
    return this._bonusType;
  }
  set bonusType(value: GrowthType) {
    if (this._bonusType == value) {
      return;
    }
    this._bonusType = value;
    this.calculate();
  }

  protected _cost: number = 0;
  get cost() {
    return this._cost;
  }
  set cost(value: number) {
    if (this._cost == value) {
      return;
    }
    this._cost = value;
    this.calculate();
  }

  protected _value: number = 0;
  get value() {
    return this._value;
  }
  protected _level: number = 0;
  get level() {
    return this._level;
  }
  set level(value: number) {
    if (this._level == value) {
      return;
    }
    this._level = value;
    this.calculate();
  }

  protected _nextCost: number = 0;
  get nextCost() {
    if (this.level == 0) {
      return this.baseCost;
    }
    return this._nextCost;
  }
  protected _nextValue: number = 0;
  get nextValue() {
    if (this.level == 0) {
      return this.baseValue;
    }
    return this._nextValue;
  }

  _canResearch: boolean = true;
  get canResearch() {
    return this._canResearch;
  }
  set canResearch(value: boolean) {
    if (this._canResearch == value) {
      return;
    }
    this._canResearch = value;
    this.calculate();
  }


  name: string = "Upgrade";
  code: string = "UPGRADE";
  get description(): string {
    return "";
  }
  icon: ImageSource = Resources.Dollar;
  isPurchased: boolean = false;

  _player!: Player;

  get player() {
    return this._player;
  }
  set player(value: Player) {
    if (this._player == value) {
      return;
    }
    this._player = value;
    this.calculate();
  }

  onBuy() { }

  /** Cost of buying the level after `level` (mirrors `nextCost`). */
  costAtLevel(level: number): number {
    if (level == 0) {
      return this.baseCost;
    }
    return Math.floor(growthFunctions[this._costType](level + 1, this._baseCost));
  }

  /**
   * How many levels can be bought in one go (up to `limit`, or as many as `balance` affords
   * when `limit` is Infinity) and what they cost in total. Always at least one level is priced
   * so the UI can show the cost of the next purchase even when it is unaffordable.
   */
  planPurchase(limit: number, balance: number): { count: number; cost: number } {
    const remaining = this.maxLevel == -1 ? Infinity : this.maxLevel - this.level;
    const cap = Math.min(limit, remaining);
    let count = 0;
    let cost = 0;
    const fitToBalance = limit === Infinity;
    while (count < cap) {
      const next = this.costAtLevel(this.level + count);
      if (fitToBalance && cost + next > balance) break;
      cost += next;
      count++;
      if (!Number.isFinite(cost) || count >= 100000) break;
    }
    if (count == 0 && cap > 0) {
      // Unaffordable "max": price one level so the button can show what is needed.
      return { count: 1, cost: this.costAtLevel(this.level) };
    }
    return { count, cost };
  }

  buy(limit: number = 1) {
    if (this.isMaxLevel || !this.canResearch) {
      return false;
    }
    const balance = this.type == "RESEARCH" ? this.player.score : this.player.prestigePoints;
    const plan = this.planPurchase(limit, balance);
    if (plan.count == 0) {
      return false;
    }
    // A fixed-size bulk buy is all-or-nothing; "buy max" (Infinity) already fits the balance.
    const didBuy = this.type == "RESEARCH"
      ? this.player.spendEnergy(plan.cost)
      : this.player.spendPrestigePoints(plan.cost);
    if (didBuy) {
      this._level += plan.count;
      this.calculate();
      this.onBuy();
      return true;
    }
    return false;
  }

  calculate() {
    if (this.maxLevel != -1) {
      this._level = Math.min(this._level, this.maxLevel);
    }
    const costFunction = growthFunctions[this._costType];
    const bonusFunction = growthFunctions[this._bonusType];
    const cost = costFunction(this._level, this._baseCost);
    const nextCost = costFunction(this._level + 1, this._baseCost);
    const value = bonusFunction(this._level, this._baseValue);
    const nextValue = bonusFunction(this._level + 1, this._baseValue);
    this._cost = Math.floor(cost);
    this._value = Math.floor(value);
    this._nextCost = Math.floor(nextCost);
    this._nextValue = Math.floor(nextValue);
    this._player?.playerUi?.refreshUpgrades();
  }
}
