import { GrowthType } from "@src/utility/big-o-calculations";
import { Upgrade } from "@src/components/upgrade-component";

export class BishopUpgrade extends Upgrade {
  override name = "Bishop";
  override code = "BISHOP";
  get description(): string {
    if (this.level == 0) {
      return [
        `{nextCost}\u23E2 - Allows building of bishop`,
        ` - Rolls dice in diagonals from the bishop.`,
      ].join("\n");
    }

    const parts = [
      ` Rolls a diagonal dice every {value} milliseconds.`,
      `{nextCost} - Decreases to every {nextValue} milliseconds.`,
    ];

    return parts.join("\n");
  }

  get value(): number {
    let amount = this.level * 50;
    return Math.min(1000 - amount + 50, 1000);
  }

  get nextValue(): number {
    let amount = (this.level + 1) * 50;
    return Math.min(1000 - amount + 50, 1000);
  }

  protected override _maxLevel: number = 20;
  override _baseCost: number = 100000;
  override _baseValue: number = 1;
  override _costType = GrowthType.LINEAR;
  override _canResearch: boolean = false;

  calculate() {
    super.calculate();
    if (this.level == 0) {
      this._nextCost = this.baseCost;
    }
    if (this.player == null) {
      return;
    }
    if (this.level >= 1) {
      this.player.unlockAction("BISHOP");
    }
  }
}
