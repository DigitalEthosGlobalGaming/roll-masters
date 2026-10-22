// One bounded pulse per die, regardless of how many buildings boost it at once.
export const diceBoostDuration = 420;
const readoutDuration = 650;

export class DiceBoostFeedback {
  private elapsed = Infinity;
  private readoutElapsed = Infinity;
  private strength = 0;

  boost(increase: number) {
    if (increase <= 0) return;
    this.readoutElapsed = 0;
    if (this.elapsed < diceBoostDuration) return;
    this.elapsed = 0;
    this.strength = Math.min(1, 0.55 + increase * 0.2);
  }

  advance(elapsed: number) {
    this.elapsed += Math.max(0, elapsed);
    this.readoutElapsed += Math.max(0, elapsed);
  }

  pose(quiet = false) {
    const t = Math.min(1, this.elapsed / diceBoostDuration);
    const active = t < 1 && !quiet;
    // Compress, spring upwards, then settle without moving the actor or hitbox.
    const spring = active ? Math.cos(t * Math.PI * 3) * (1 - t) ** 3 * this.strength : 0;
    return {
      scaleX: 1 + 0.18 * spring,
      scaleY: 1 - 0.18 * spring,
      y: active ? -2.5 * Math.sin(t * Math.PI) * (1 - t) * this.strength : 0,
      ringRadius: 10 + 5 * (1 - (1 - t) ** 3),
      ringOpacity: active ? 0.65 * (1 - t) ** 2 : 0,
      readoutOpacity: Math.min(1, Math.max(0, (readoutDuration - this.readoutElapsed) / 180)),
    };
  }
}
