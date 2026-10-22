import test from "node:test";
import assert from "node:assert/strict";
import * as ex from "./ui-runtime.mjs";
import { Building } from "../src/building.ts";
import { Roller } from "../src/buildings/roller.ts";
import { Dice } from "../src/buildings/dice.ts";
import { motionPreferences } from "../src/settings/motion-preferences.ts";

test("dice read both serialized speed keys without changing their save format", () => {
  const die = new Dice();
  for (const data of [{ speed: 2 }, { rollSpeed: 3 }, {}]) {
    die.deserialize({ ...data, faces: 6, value: 4, pos: { _x: 0, _y: 0 } });
    assert.equal(die.rollSpeed, data.rollSpeed ?? data.speed ?? 1);
    assert.equal(die.serialize().speed, die.rollSpeed);
    assert.equal(die.value, 4);
  }
});

test("rolls reuse face artwork without sharing tint or animation state between dice", () => {
  const a = new Dice(), b = new Dice();
  a.scene = b.scene = { player: { getUpgrade: () => undefined } };
  ex.Environment.set("graphics", ex.Settings.graphics.advanced);
  a.rollDice(); b.rollDice();
  const firstAnimation = a.graphics.current;
  const faces = a.faceSprites;
  assert.ok(faces.every(face => !b.faceSprites.includes(face)));
  for (const face of faces) face.tint = new ex.Color("boost-yellow");
  a.rolling = false; a.rollDice();
  assert.notEqual(a.graphics.current, firstAnimation);
  assert.equal(a.faceSprites, faces);
  assert.ok(a.graphics.current.frames.every(frame => faces.includes(frame.graphic) && frame.graphic.tint === undefined));
  assert.ok(b.faceSprites.every(face => face.tint === undefined));
});

test("stationary buildings retain transforms but moving buildings still approach their targets", () => {
  const building = new Building();
  const position = building.pos, scale = building.scale;
  for (let i = 0; i < 100; i++) building.onPreUpdate({}, 16);
  assert.equal(building.pos, position);
  assert.equal(building.scale, scale);
  assert.equal(building.body.collisionType, ex.CollisionType.PreventCollision);
  building.pos = ex.vec(5, 0); building.scale = ex.vec(2, 2);
  building.onPreUpdate({}, 16);
  assert.ok(building.pos.x < 5 && building.pos.x > 0);
  assert.ok(building.scale.x < 2 && building.scale.x > 1);
  for (let i = 0; i < 100; i++) building.onPreUpdate({}, 16);
  assert.deepEqual(building.pos, ex.vec(0, 0));
  assert.deepEqual(building.scale, ex.vec(1, 1));
});

test("long cyclic pawn chains activate each pawn and shared die once without recursion", () => {
  const pawns = Array.from({ length: 2000 }, () => new Roller());
  let rolls = 0, activations = 0;
  const die = new ex.Entity(); die.rollDice = () => rolls++;
  pawns.forEach((pawn, i) => {
    pawn.playActivation = () => activations++;
    pawn.getNeighbors = () => ({ left: { children: [pawns[(i + 1) % pawns.length], die] }, right: { children: [pawns[(i + pawns.length - 1) % pawns.length]] } });
  });
  pawns[0].rollDice();
  assert.equal(activations, pawns.length);
  assert.equal(rolls, 1);
});

test("pawn queue stays bounded and its timer is released and recreated across scenes", () => {
  const scene = () => ({ timers: [], addTimer(timer) { timer.scene = this; this.timers.push(timer); }, removeTimer(timer) { this.timers = this.timers.filter(t => t !== timer); } });
  const first = scene(), second = scene();
  const a = new Roller(), b = new Roller();
  a.scene = b.scene = first;
  a.rollDice = b.rollDice = () => {};
  const previousRolls = Roller.rollsPerTick;
  try {
    a.onAdd({}); b.onAdd({});
    assert.equal(first.timers.length, 1);
    Roller.rollsPerTick = 0;
    for (let i = 0; i < 4; i++) { Roller.lastGlobalTick = 1; Roller.rollRollers(); }
    assert.equal(Roller.rollerQueue.length, 2);
    a.onRemove({}); assert.equal(Roller.rollerQueue.length, 1);
    b.onRemove({}); assert.equal(first.timers.length, 0);
    assert.equal(Roller.globalTimer, null); assert.equal(Roller.lastGlobalTick, 0);
    a.scene = second; a.onAdd({});
    assert.equal(second.timers.length, 1); assert.ok(Roller.globalTimer.isRunning);
    b.scene = first; b.onAdd({});
    assert.equal(second.timers.length, 0); assert.equal(first.timers.length, 1);
    assert.deepEqual(Object.values(Roller.rollers), [b]);
  } finally { Roller.resetAutomation(); Roller.rollsPerTick = previousRolls; }
});

test("cached motion preferences follow graphics and reduced-motion settings", () => {
  try {
    ex.Environment.set("graphics", ex.Settings.graphics.advanced);
    ex.Environment.set("reduced-motion", false);
    assert.equal(motionPreferences.quiet, false);
    ex.Environment.set("graphics", ex.Settings.graphics.basic);
    assert.equal(motionPreferences.quiet, true);
    assert.equal(motionPreferences.reduced, false);
    ex.Environment.set("graphics", ex.Settings.graphics.advanced);
    ex.Environment.set("reduced-motion", true);
    assert.equal(motionPreferences.quiet, true); assert.equal(motionPreferences.reduced, true);
    ex.Environment.set("reduced-motion", false);
    ex.setReducedMotion(true); assert.equal(motionPreferences.quiet, true);
    ex.setReducedMotion(false); assert.equal(motionPreferences.quiet, false);
  } finally { ex.Environment.set("reduced-motion", false); ex.Environment.set("graphics", ex.Settings.graphics.advanced); }
});
