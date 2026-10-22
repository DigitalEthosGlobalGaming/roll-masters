import test from "node:test";
import assert from "node:assert/strict";
import { PieceFeedback } from "../src/buildings/piece-feedback.ts";

const rest = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

test("knight contact fires once on landing, never in midair", () => {
  const feedback = new PieceFeedback("knight");
  let contacts = 0;
  feedback.move(-32, 0);
  feedback.whenPassed(1, () => contacts++);
  feedback.advance(239);
  assert.equal(contacts, 0);
  assert.ok(feedback.pose().y < 0);
  feedback.advance(1);
  assert.equal(contacts, 1);
  assert.equal(feedback.pose().x, 0);
  assert.equal(feedback.pose().y, 0);
  feedback.advance(10000);
  assert.equal(contacts, 1);
});

test("rook contacts follow its eased position rather than linear elapsed time", () => {
  const feedback = new PieceFeedback("rook");
  const contacts = [];
  feedback.move(-96, 0);
  feedback.whenPassed(1 / 3, () => contacts.push("first"));
  feedback.whenPassed(2 / 3, () => contacts.push("second"));
  feedback.advance(30);
  assert.deepEqual(contacts, []);
  feedback.advance(40);
  assert.ok(feedback.pose().x > -64 && feedback.pose().x < -32);
  assert.deepEqual(contacts, ["first"]);
  feedback.advance(40);
  assert.ok(feedback.pose().x > -32);
  assert.deepEqual(contacts, ["first", "second"]);
  feedback.advance(10000);
  assert.deepEqual(contacts, ["first", "second"]);
});

test("long frames deliver all crossed contacts and retargeting drops unreached contacts", () => {
  const feedback = new PieceFeedback("rook");
  const contacts = [];
  feedback.move(-96, 0);
  feedback.whenPassed(1 / 3, () => contacts.push(1));
  feedback.whenPassed(2 / 3, () => contacts.push(2));
  feedback.advance(10000);
  assert.deepEqual(contacts, [1, 2]);
  feedback.move(-32, 0);
  feedback.whenPassed(1, () => contacts.push(3));
  feedback.move(32, 0);
  feedback.advance(10000);
  assert.deepEqual(contacts, [1, 2]);
});

test("knights hop and rooks glide, then land before their next normal tick", () => {
  for (const style of ["knight", "rook"]) {
    const feedback = new PieceFeedback(style);
    assert.deepEqual(feedback.pose(), rest);
    feedback.move(-32, 0);
    const start = feedback.pose();
    assert.equal(start.x, -32);
    assert.equal(start.y, 0);
    assert.ok(Math.abs(start.rotation) === 0);
    assert.equal(start.scaleX, 1);
    assert.equal(start.scaleY, 1);
    feedback.advance(120);
    const mid = feedback.pose();
    assert.ok(mid.x > -32 && mid.x < 0);
    assert.ok(mid.y < (style === "knight" ? -5 : 0));
    assert.ok(mid.scaleY > 1);
    feedback.advance(300);
    assert.deepEqual(feedback.pose(), rest);
  }
});

test("travel is independent of frame rate and settles exactly after long frames", () => {
  for (const style of ["knight", "rook"]) {
    const smallFrames = new PieceFeedback(style);
    const oneFrame = new PieceFeedback(style);
    smallFrames.move(64, -32);
    oneFrame.move(64, -32);
    for (let i = 0; i < 12; i++) smallFrames.advance(10);
    oneFrame.advance(120);
    assert.deepEqual(smallFrames.pose(), oneFrame.pose());
    oneFrame.advance(10000);
    assert.deepEqual(oneFrame.pose(), rest);
  }
});

test("retargeted moves start from the current displayed location", () => {
  const feedback = new PieceFeedback("knight");
  feedback.move(-32, 0);
  feedback.advance(100);
  const before = feedback.pose();
  // The next destination is another 32px to the right.
  feedback.move(before.x - 32, before.y);
  assert.ok(Math.abs(feedback.pose().x + 32 - before.x) < 1e-9);
  assert.equal(feedback.pose().y, before.y);
  feedback.advance(10000);
  assert.deepEqual(feedback.pose(), rest);
});

test("quiet mode removes movement, squash, and tilt without pausing feedback clocks", () => {
  for (const style of ["pawn", "bishop", "knight", "rook"]) {
    const feedback = new PieceFeedback(style);
    feedback.move(320, -64);
    feedback.advance(100);
    assert.deepEqual(feedback.pose(true), rest);
    feedback.advance(10000);
    assert.deepEqual(feedback.pose(), rest);
    feedback.activate();
    feedback.advance(50);
    assert.deepEqual(feedback.pose(true), rest);
  }
});

test("stationary activations are bounded, finish, and cannot be restarted every frame", () => {
  for (const style of ["pawn", "bishop"]) {
    const feedback = new PieceFeedback(style);
    feedback.activate();
    feedback.advance(60);
    assert.notDeepEqual(feedback.pose(), rest);
    const before = feedback.pose();
    feedback.activate();
    assert.deepEqual(feedback.pose(), before);
    for (let i = 0; i < 20; i++) {
      feedback.advance(10);
      const pose = feedback.pose();
      assert.ok(Math.abs(pose.rotation) < 0.1);
      assert.ok(pose.scaleX > 0.85 && pose.scaleX < 1.15);
      assert.ok(pose.scaleY > 0.85 && pose.scaleY < 1.15);
    }
    assert.deepEqual(feedback.pose(), rest);
  }
});
