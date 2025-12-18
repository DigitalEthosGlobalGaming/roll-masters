import { GrowthType } from "@src/utility/big-o-calculations";
import { Upgrade } from "@src/components/upgrade-component";

export class WanderingKnightUpgrade extends Upgrade {
  override name = "Wandering Knight";
  override code = "KNIGHT";
  get description(): string {
    if (this.level == 0) {
      return [
        `{nextCost}\u23E2 - Allows building of wandering knight`,
        ` - Moves around the board giving dice a multiplier.`,
      ].join("\n");
    }

    const parts = [
      ` adds x${Math.round(this.value) / 10
      } to a dice's multiplier when moving into a neighboring tile.`,
      `{nextCost} - Increase to x${Math.round(this._nextValue) / 10}`,
    ];

    return parts.join("\n");
  }
  override _baseCost: number = 10000;
  override _baseValue: number = 1;
  override _costType = GrowthType.LOGARITHMIC;
  override _bonusType = GrowthType.LINEAR;
  override _canResearch: boolean = false;

  calculate() {
    super.calculate();
    if (this.level == 0) {
      this._nextCost = 2500;
    }
    if (this.player == null) {
      return;
    }
    if (this.level >= 1) {
      this.player.unlockAction("NEWKNIGHT");
    }
    if (this.level >= 5) {
      this.player.unlockResearch("Bishop");
      this.player.unlockResearch("Rook");
    }
  }
}
