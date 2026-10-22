import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";

const storage = new Map([["environment", JSON.stringify({ sound: 0, graphics: 1 })]]);
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
const moduleUrl = source => `data:text/javascript,${encodeURIComponent(source)}`;
const source = path => stripTypeScriptTypes(readFileSync(new URL(path, import.meta.url), "utf8"));
const envUrl = moduleUrl(source("../src/env.ts"));
const { Environment } = await import(envUrl);
const volumeUrl = moduleUrl(source("../src/settings/audio-settings.ts").replace('from "@src/env"', `from "${envUrl}"`));
const { volumePercent } = await import(volumeUrl);
const soundUrl = moduleUrl(`
export class Sound {
  volume = 1; plays = 0; stopped = false;
  load() { return Promise.resolve(); }
  play() { this.plays++; return Promise.resolve(true); }
  isLoaded() { return true; }
  isStopped() { return this.stopped; }
  stop() { this.stopped = true; }
  once(_event, next) { this.next = next; }
}
export const SoundPaths = Object.fromEntries(["ChipLay2", "ScoreSound", "Soundtrack1", "Soundtrack2", "Soundtrack3", "Soundtrack4", "Soundtrack5"].map(key => [key, key]));
export const Sounds = {};
`);
const { Sounds } = await import(soundUrl);
const { SoundManager } = await import(moduleUrl(source("../src/sound-manager.ts")
  .replace('from "@src/env"', `from "${envUrl}"`)
  .replace('from "@src/resources"', `from "${soundUrl}"`)
  .replace('from "excalibur"', `from "${soundUrl}"`)
  .replace('from "@src/settings/audio-settings"', `from "${volumeUrl}"`)));

test("legacy settings keep full volume and channel levels persist independently", () => {
  assert.equal(volumePercent("music-volume"), 100);
  assert.equal(volumePercent("effects-volume"), 100);
  Environment.set("music-volume", 35); Environment.set("effects-volume", 0);
  const saved = JSON.parse(storage.get("environment"));
  assert.equal(saved.graphics, 1);
  assert.equal(saved["music-volume"], 35); assert.equal(saved["effects-volume"], 0);
  Environment.data = {}; Environment.load();
  assert.equal(volumePercent("music-volume"), 35); assert.equal(volumePercent("effects-volume"), 0);
  for (const [value, expected] of [[-20, 0], [140, 100], [32.7, 33], [NaN, 100], ["bad", 100]]) {
    Environment.set("music-volume", value); assert.equal(volumePercent("music-volume"), expected);
  }
});

test("audio channels update live, respect mute modes and keep levels across track changes", () => {
  Environment.set("music-volume", 30); Environment.set("effects-volume", 65); Environment.set("sound", 0);
  SoundManager.initialise({});
  const manager = SoundManager.instance;
  SoundManager.initialise({}); assert.equal(SoundManager.instance, manager);
  manager.playBackgroundMusic();
  const first = manager.lastPlayedMusic;
  assert.equal(first.volume, 0.3);
  manager.play("ChipLay2"); assert.equal(Sounds.ChipLay2.volume, 0.65); assert.equal(Sounds.ChipLay2.plays, 1);
  Environment.set("music-volume", 15); assert.equal(first.volume, 0.15);
  Environment.set("effects-volume", 20); assert.equal(Sounds.ChipLay2.volume, 0.2);
  Environment.set("sound", 1); assert.equal(first.volume, 0); assert.equal(Sounds.ChipLay2.volume, 0.2);
  Environment.set("sound", 2); assert.equal(Sounds.ChipLay2.volume, 0);
  manager.play("ChipLay2"); assert.equal(Sounds.ChipLay2.plays, 1);
  Environment.set("sound", 0); assert.equal(first.volume, 0.15); assert.equal(Sounds.ChipLay2.volume, 0.2);
  first.next(); assert.notEqual(manager.lastPlayedMusic, first); assert.equal(manager.lastPlayedMusic.volume, 0.15);
  Environment.set("effects-volume", 0); manager.play("ChipLay2"); assert.equal(Sounds.ChipLay2.plays, 1);
});
