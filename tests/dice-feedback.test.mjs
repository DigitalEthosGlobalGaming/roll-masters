import test from "node:test";
import assert from "node:assert/strict";
import {
  diceFrameDurations, diceSettleDuration, diceSettlePose,
  diceTumblePose, restingDicePose,
} from "../src/buildings/dice-feedback.ts";

test("face changes slow down without extending the roll or speed upgrades", () => {
  for (const count of [10, 12, 14]) {
    for (const duration of [950, 95, 9.5]) {
      const frames = diceFrameDurations(count, duration);
      assert.equal(frames.length, count);
      assert.ok(Math.abs(frames.reduce((a, b) => a + b, 0) - duration) < 1e-9);
      assert.ok(frames.every((frame, i) => frame > 0 && (i === 0 || frame > frames[i - 1])));
    }
  }
});

test("visual motion is bounded and returns exactly to rest after a long frame", () => {
  for (const direction of [-1, 1]) {
    for (let i = 0; i <= 100; i++) {
      const pose = diceTumblePose(i / 100, direction);
      assert.ok(Math.abs(pose.x) <= 1.5);
      assert.ok(pose.y >= -3 && pose.y <= 0);
      assert.ok(Math.abs(pose.rotation) <= 0.28);
      assert.ok(pose.scaleX > 0.9 && pose.scaleX < 1.1);
      assert.ok(pose.scaleY > 0.9 && pose.scaleY < 1.1);
    }
    for (const progress of [0, 1, 10]) {
      assert.deepEqual(diceTumblePose(progress, direction), restingDicePose);
    }
  }
  for (const highRoll of [false, true]) {
    assert.ok(diceSettlePose(0, highRoll).scaleY < 1);
    assert.ok(diceSettlePose(diceSettleDuration / 2, highRoll).scaleY > 1);
    assert.deepEqual(diceSettlePose(diceSettleDuration, highRoll), restingDicePose);
    assert.deepEqual(diceSettlePose(10000, highRoll), restingDicePose);
  }
  assert.ok(diceSettlePose(0, true).scaleX > diceSettlePose(0, false).scaleX);
});
