import { GrowthType } from "@src/utility/big-o-calculations";
import { Upgrade, UpgradeType } from "@src/components/upgrade-component";

export class BetterPassiveEnergyUpgrade extends Upgrade {
  override name = "Passive Gold Boost";
  override code = "PASSIVE_BOOST";
  type: UpgradeType = "PRESTIGE";

  get description(): string {
    const parts = [
      `Passive gold bonus: ${this.value}% → ${this.nextValue}%`,
    ];

    return parts.join("\n");
  }
  override _baseCost: number = 1;
  override _baseValue: number = 100;
  override _costType = GrowthType.LINEAR;
  override _bonusType = GrowthType.LINEAR;

}
