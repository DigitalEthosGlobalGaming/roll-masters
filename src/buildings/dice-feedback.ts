// Pure visual curves: no roll outcomes, actor transforms, or simulation clocks.
export const diceSettleDuration = 180;

export const restingDicePose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

export function diceFrameDurations(count: number, duration: number): number[] {
  const weights = Array.from({ length: count }, (_, i) => 1 + 3 * (i / Math.max(1, count - 1)) ** 2);
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map(weight => duration * weight / total);
}

export function diceTumblePose(progress: number, direction: number) {
  const t = Math.max(0, Math.min(1, progress));
  if (t === 0 || t === 1) return restingDicePose;
  const envelope = Math.sin(Math.PI * t) * (1 - t);
  const wobble = Math.sin(t * Math.PI * 8) * envelope;
  return {
    x: direction * 1.5 * wobble,
    y: -3 * Math.sin(Math.PI * t),
    rotation: direction * 0.28 * wobble,
    scaleX: 1 + 0.08 * wobble,
    scaleY: 1 - 0.08 * wobble,
  };
}

export function diceSettlePose(elapsed: number, highRoll: boolean) {
  const t = Math.max(0, Math.min(1, elapsed / diceSettleDuration));
  if (t === 1) return restingDicePose;
  // Compression, a smaller rebound, then an exact return to rest.
  const squash = Math.cos(t * Math.PI * 2.5) * (1 - t) ** 3 * (highRoll ? 0.23 : 0.15);
  return {
    x: 0,
    y: 8 * squash,
    rotation: 0,
    scaleX: 1 + squash,
    scaleY: 1 - squash,
  };
}
