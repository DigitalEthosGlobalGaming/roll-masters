import { GrowthType } from "@src/utility/big-o-calculations";
import { Upgrade, UpgradeType } from "@src/components/upgrade-component";

export class BetterPassiveEnergyUpgrade extends Upgrade {
  override name = "Passive Gold Boost";
  override code = "PASSIVE_BOOST";
  type: UpgradeType = "PRESTIGE";

  get description(): string {
    const parts = [
      `Passive gold increased by ${this.value}%`,
      `{nextCost}⏣ - Increases the amount of passive income by ${this.nextValue}%`,
    ];

    return parts.join("\n");
  }
  override _baseCost: number = 1;
  override _baseValue: number = 100;
  override _costType = GrowthType.LINEAR;
  override _bonusType = GrowthType.LINEAR;

}
