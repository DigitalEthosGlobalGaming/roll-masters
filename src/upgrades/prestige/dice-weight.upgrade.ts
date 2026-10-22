import { GrowthType } from "@src/utility/big-o-calculations";
import { Upgrade, UpgradeType } from "@src/components/upgrade-component";
import { Dice } from "@src/buildings/dice";

/**
 * Returns the expected value of a "weighted die" where:
 * - You roll a random integer from 1 to (6 + weight).
 * - If the roll exceeds 6, it is treated as a 6.
 *
 * @param weight - The integer "extra" weight. Must be >= 0.
 * @returns The expected value of the resulting "weighted die".
 */
function getWeightedDieExpectedValue(weight: number): number {
  // Formula: E(w) = (21 + 6 * w) / (6 + w)
  // Explanation:
  //   - Probability of rolling 1..6 is 6 / (6 + w), average of 1..6 is 3.5
  //   - Probability of rolling 7..(6 + w) is w / (6 + w), each counts as 6
  //   E(w) = 3.5 * (6/(6+w)) + 6 * (w/(6+w)) = (21 + 6w) / (6 + w)

  if (weight < 0) {
    throw new Error("Weight must be non-negative.");
  }

  return (21 + 6 * weight) / (6 + weight);
}

/**
 * Returns the percentage improvement of the weighted die's average
 * over the fair die's average (3.5).
 *
 * The fair (unweighted) die average is 3.5.
 *
 * @param weight - The integer "extra" weight. Must be >= 0.
 * @returns The percentage increase in the expected value compared to a fair die.
 *
 * Example:
 *   If the weighted die's average is 4.125, and the fair die's average is 3.5,
 *   the percentage improvement is:
 *       ((4.125 - 3.5) / 3.5) * 100% ≈ 17.9%
 */
function getWeightedDiePercentageImprovement(weight: number): number {
  // We can either compute E(w) and then do:
  //   percentage = 100 * ( (E(w) - 3.5) / 3.5 )
  //
  // Or use the direct simplified formula:
  //   percentage = 100 * (5w / [7(6 + w)])
  //
  // Both yield the same result. Let's do it step by step for clarity.

  // 1) Get the weighted die's expected value
  const eW = getWeightedDieExpectedValue(weight); // E(w)

  // 2) Calculate improvement over 3.5
  const improvement = eW - 3.5; // difference from fair die's 3.5

  // 3) Convert that difference into a fraction of 3.5
  const fractionImprovement = improvement / 3.5;

  // 4) Convert to percentage
  const percentageImprovement = fractionImprovement * 100;

  return percentageImprovement;
}

export class DiceWeightUpgrade extends Upgrade {
  override name = "Dice Weight";
  override code = "DICE_WEIGHT";
  type: UpgradeType = "PRESTIGE";
  get description(): string {
    const nextImprovement = Math.floor(getWeightedDiePercentageImprovement(this.nextValue));
    const parts = [
      `Average roll bonus: +${Math.floor(getWeightedDiePercentageImprovement(this.value))}% → +${nextImprovement}%`,
      "More rolls land on six.",
    ];

    return parts.join("\n");
  }
  protected override _maxLevel: number = 15;
  override _baseCost: number = 2;
  override _baseValue: number = 1;
  override _costType = GrowthType.QUADRATIC;
  override _bonusType = GrowthType.LINEAR;


  onBuy(): void {
    super.onBuy();
    const gridSystem = this.player.getScene().gridSystem;
    const spaces = gridSystem?.spaces;
    if (spaces == null) {
      return;
    }
    for (const spaceIndex in spaces) {
      const space = spaces[spaceIndex];
      if (space != null) {
        const dice = space.children.filter((item) => item instanceof Dice);
        dice.forEach((item) => {
          item.weight = this.value;
        });
      }
    }
  }
}
