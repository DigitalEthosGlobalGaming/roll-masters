import { GrowthType } from "@src/utility/big-o-calculations";
import { Upgrade, UpgradeType } from "@src/components/upgrade-component";

export class GridSizeUpgrade extends Upgrade {
  override name = "Grid Size";
  override code = "GRID_SIZE";
  type: UpgradeType = "PRESTIGE";
  get description(): string {
    const parts = [
      `Board: ${this.value + 16} × ${this.value + 16} → ${this.nextValue + 16} × ${this.nextValue + 16}`,
    ];

    return parts.join("\n");
  }
  protected override _maxLevel: number = 16;
  override _baseCost: number = 1;
  override _baseValue: number = 1;
  override _costType = GrowthType.LINEAR;
  override _bonusType = GrowthType.LINEAR;

  onBuy(): void {
    super.onBuy();
    this.player.getScene().resizeGrid();
  }
}
