import { GrowthType } from "@src/utility/big-o-calculations";
import { Upgrade } from "@src/components/upgrade-component";

export class RookUpgrade extends Upgrade {
  override name = "Rook";
  override code = "ROOK";
  get description(): string {
    if (this.level == 0) {
      return [
        `{nextCost}\u23E2 - Allows building of a Rook`,
        ` - Moves through dice to the next free space.`,
        " - Adding multipliers to all dice passed.",
      ].join("\n");
    }

    const parts = [
      ` adds {value}to a dice's multiplier when moving through.`,
      `{nextCost} - Increase to {nextValue}\u23E2`,
    ];

    return parts.join("\n");
  }
  override _baseCost: number = 250000;
  override _baseValue: number = 1;
  override _costType = GrowthType.LOGARITHMIC;
  override _bonusType = GrowthType.LINEAR;
  override _canResearch: boolean = false;

  calculate() {
    super.calculate();
    if (this.level == 0) {
      this._nextCost = 500000;
    }
    if (this.player == null) {
      return;
    }
    if (this.level >= 1) {
      this.player.unlockAction("ROOK");
    }
    if (this.level >= 5) {
      this.player.unlockResearch("Bishop");
    }
  }
}
