import test from "node:test";
import assert from "node:assert/strict";
import { DiceBoostFeedback, diceBoostDuration } from "../src/buildings/dice-boost-feedback.ts";

test("boost pulses scale with importance, remain bounded, and return to rest", () => {
  const small = new DiceBoostFeedback();
  const large = new DiceBoostFeedback();
  assert.equal(small.pose().readoutOpacity, 0);
  small.boost(0.1);
  large.boost(100);
  assert.ok(large.pose().scaleX > small.pose().scaleX);
  for (let elapsed = 0; elapsed < diceBoostDuration; elapsed += 10) {
    const pose = large.pose();
    assert.ok(pose.scaleX >= 0.82 && pose.scaleX <= 1.18);
    assert.ok(pose.scaleY >= 0.82 && pose.scaleY <= 1.18);
    assert.ok(pose.y >= -2.5 && pose.y <= 0);
    assert.ok(pose.ringOpacity >= 0 && pose.ringOpacity <= 0.65);
    large.advance(10);
  }
  assert.equal(large.pose().scaleX, 1);
  assert.equal(large.pose().scaleY, 1);
  assert.equal(large.pose().y, 0);
  assert.equal(large.pose().ringOpacity, 0);
  large.advance(10000);
  assert.equal(large.pose().readoutOpacity, 0);
});

test("rapid boosts refresh the readout without holding the motion at impact", () => {
  const feedback = new DiceBoostFeedback();
  feedback.boost(0.1);
  feedback.advance(100);
  const before = feedback.pose();
  feedback.boost(1);
  assert.deepEqual(feedback.pose(), before);
  for (let i = 0; i < 32; i++) {
    feedback.boost(1);
    feedback.advance(10);
  }
  assert.equal(feedback.pose().scaleX, 1);
  assert.equal(feedback.pose().ringOpacity, 0);
  feedback.boost(1);
  assert.ok(feedback.pose().ringOpacity > 0);
});

test("quiet mode keeps a readable boost cue without movement or a ring", () => {
  const feedback = new DiceBoostFeedback();
  feedback.boost(1);
  feedback.advance(80);
  const quiet = feedback.pose(true);
  assert.equal(quiet.scaleX, 1);
  assert.equal(quiet.scaleY, 1);
  assert.equal(quiet.y, 0);
  assert.equal(quiet.ringOpacity, 0);
  assert.equal(quiet.readoutOpacity, 1);
  feedback.advance(10000);
  assert.equal(feedback.pose().readoutOpacity, 0);
});

test("multiplier consumption is silent and feedback timing is frame independent", () => {
  const smallFrames = new DiceBoostFeedback();
  const longFrame = new DiceBoostFeedback();
  for (const feedback of [smallFrames, longFrame]) feedback.boost(1);
  for (let i = 0; i < 10; i++) smallFrames.advance(10);
  longFrame.advance(100);
  assert.deepEqual(smallFrames.pose(), longFrame.pose());
  const before = longFrame.pose();
  longFrame.boost(-1);
  longFrame.boost(0);
  assert.deepEqual(longFrame.pose(), before);
});
