import test from "node:test";
import assert from "node:assert/strict";
import { TutorialDirector } from "../src/tutorial/tutorial-director.ts";
import { tutorialSteps } from "../src/tutorial/tutorial-steps.ts";
import { ease } from "../src/easing.ts";

const none = { action: "NONE", dice: 0, pawns: 0 };
const ids = director => director.step?.id;

test("step ids are unique and every step can finish", () => {
  assert.equal(new Set(tutorialSteps.map(step => step.id)).size, tutorialSteps.length);
  for (const step of tutorialSteps) {
    assert.ok(step.button || step.done || step.signal, `${step.id} has no way to complete`);
  }
});

test("a new player is walked through placing, rolling and automating", () => {
  const director = new TutorialDirector();
  const changes = [];
  director.onChange = change => changes.push(change.type);
  director.start(none);
  assert.equal(ids(director), "welcome");
  assert.ok(!director.signal("built:Dice", none), "events are ignored until their step");

  assert.ok(director.next(none));
  assert.equal(ids(director), "pick-dice");
  assert.ok(director.refresh({ ...none, action: "NEWDICE" }));
  assert.equal(ids(director), "place-dice");
  assert.ok(!director.refresh({ ...none, action: "NEWDICE" }), "event-only steps do not complete from state");
  assert.ok(director.signal("built:Dice", { action: "NEWDICE", dice: 0, pawns: 0 }));
  assert.equal(ids(director), "pick-roll");
  assert.ok(director.refresh({ action: "NONE", dice: 1, pawns: 0 }));
  assert.equal(ids(director), "roll-dice");
  assert.ok(director.signal("rolled:Dice", none));
  assert.ok(director.next(none));
  assert.equal(ids(director), "pick-pawn");
  assert.ok(director.refresh({ action: "NEWROLLER", dice: 1, pawns: 0 }));
  assert.ok(director.signal("built:Pawn", none));
  assert.equal(ids(director), "roll-pawn");
  assert.ok(director.signal("rolled:Pawn", none));
  assert.equal(ids(director), "pieces");
  assert.ok(director.next(none));
  assert.equal(ids(director), "finish");
  assert.ok(director.next(none));
  assert.equal(director.status, "finished");
  assert.equal(director.step, null);
  assert.equal(changes.at(-1), "finished");
});

test("resuming skips lessons the board already satisfies", () => {
  const director = new TutorialDirector();
  director.start({ action: "NONE", dice: 2, pawns: 0 }, 1);
  assert.equal(ids(director), "roll-dice");
  director.start({ action: "NEWROLLER", dice: 1, pawns: 0 }, 6);
  assert.equal(ids(director), "place-pawn");
  director.start({ action: "NONE", dice: 1, pawns: 1 }, 6);
  assert.equal(ids(director), "roll-pawn");
});

test("button-less steps cannot be skipped by pressing next, and skip is final", () => {
  const director = new TutorialDirector();
  director.start(none, 1);
  assert.ok(!director.next(none));
  let skipped = 0;
  director.onChange = change => { if (change.type === "skipped") skipped++; };
  director.skip();
  director.skip();
  assert.equal(director.status, "skipped");
  assert.equal(skipped, 1);
  assert.ok(!director.refresh({ ...none, action: "NEWDICE" }));
});

test("UI easing helpers stay bounded and land exactly on 1", () => {
  for (const name of ["easeOutBack", "easeOutCubic"]) {
    assert.ok(Math.abs(ease(name, 0)) < 1e-12);
    assert.ok(Math.abs(ease(name, 1) - 1) < 1e-12);
  }
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => ease("easeOutBack", i / 100)));
  assert.ok(peak > 1 && peak < 1.15, "overshoots slightly");
  for (let i = 1; i <= 100; i++) assert.ok(ease("easeOutCubic", i / 100) >= ease("easeOutCubic", (i - 1) / 100));
});
