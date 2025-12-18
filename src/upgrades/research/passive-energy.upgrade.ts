import { GrowthType } from "@src/utility/big-o-calculations";
import { Upgrade } from "@src/components/upgrade-component";

const parts = [
  `Generates {value}\u23E2 every second.`,
  `{nextCost}\u23E2 - Increase to {nextValue}\u23E2`,
];
export class PassiveEnergyComponent extends Upgrade {
  override name = "Passive Gold";
  override code = "PASSIVE_ENERGY";
  constructor() {
    super();
    this.level = 1;
    this.maxLevel = 20;
    this.calculate();
  }
  get description(): string {
    return parts.join("\n");
  }
  override _baseCost: number = 100;
  override _baseValue: number = 1;
  override _costType = GrowthType.EXPONENTIAL;
  override _bonusType = GrowthType.QUADRATIC;
}
