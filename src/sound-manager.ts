import { SoundPaths, Sounds } from "@src/resources";
import type { SoundKey } from "@src/resources";
import { random } from "@src/utility/random";
import { Environment, Settings } from "@src/env";
import * as ex from "excalibur";
import { audioVolume } from "@src/settings/audio-settings";
export interface GroupedSoundOptions {
  /** Hits dropped once this many voices started within `voiceWindow`. */
  maxVoices?: number;
  /** How long (ms) a started hit counts as an active voice. */
  voiceWindow?: number;
  /** Base volume multiplier, 0..1. */
  volume?: number;
  /** Max random volume reduction, 0..1. */
  volumeJitter?: number;
  /** How strongly each active voice lowers the next hit. */
  crowdFalloff?: number;
}

export class SoundManager {
  static _instance: SoundManager | null = null;
  static playVaried(group: string, keys: SoundKey[], options?: GroupedSoundOptions) {
    SoundManager.instance?.playVaried(group, keys, options);
  }
  static get instance() {
    return SoundManager._instance;
  }
  static play(sound: keyof typeof Sounds | ex.Sound) {
    if (SoundManager.instance == null) {
      return;
    }
    SoundManager.instance.play(sound);
  }
  static initialise(engine: ex.Engine) {
    if (SoundManager._instance) return;
    SoundManager._instance = new SoundManager(engine);
  }

  protected engine: ex.Engine;
  constructor(engine: ex.Engine) {
    this.engine = engine;
    try {
      for (const soundKey in SoundPaths) {
        let sound = Sounds[soundKey as keyof typeof SoundPaths];
        if (sound != null) {
          continue;
        }
        let newSound = new ex.Sound(
          SoundPaths[soundKey as keyof typeof SoundPaths]
        );
        newSound.load();
        Sounds[soundKey as keyof typeof SoundPaths] = newSound;
      }
    } catch (e) {
      console.error(e);
    }
    Environment.onChange(() => this.applySettings());
    this.applySettings();
  }
  play(sound: ex.Sound | keyof typeof Sounds) {
    if (Environment.get("sound") === Settings.sound.Off) return;
    if (typeof sound === "string") {
      if (Sounds[sound] != null) {
        sound = Sounds[sound];
      }
    }
    if (sound instanceof ex.Sound) {
      const music = this.soundtracks.some(key => Sounds[key] === sound);
      sound.volume = audioVolume(music ? "music-volume" : "effects-volume");
      if (sound.volume > 0) sound.play();
    }
  }
  private groupVoices = new Map<string, number[]>();

  /**
   * Plays one random take from a pool, for sounds that can fire hundreds of times.
   * Caps simultaneous voices per group, and lowers each hit as the group gets busier
   * so a crowd reads as a texture instead of a wall of identical clicks.
   */
  playVaried(group: string, keys: SoundKey[], options: GroupedSoundOptions = {}) {
    if (Environment.get("sound") === Settings.sound.Off) return;
    const { maxVoices = 4, voiceWindow = 220, volume = 1, volumeJitter = 0.15, crowdFalloff = 0.35 } = options;
    const now = performance.now();
    const active = (this.groupVoices.get(group) ?? []).filter(start => now - start < voiceWindow);
    this.groupVoices.set(group, active);
    if (active.length >= maxVoices) return;

    const sound = Sounds[random.fromArray(keys)];
    if (!(sound instanceof ex.Sound)) return;
    // Quieter as more voices are active; jitter keeps repeated takes from sounding identical.
    const crowd = 1 / Math.sqrt(1 + active.length * crowdFalloff * 4);
    const jitter = 1 - random.number(0, volumeJitter);
    const level = audioVolume("effects-volume") * volume * crowd * jitter;
    if (level <= 0) return;
    active.push(now);
    sound.play(Math.min(1, level));
  }

  soundtracks: SoundKey[] = [
    "Soundtrack1",
    "Soundtrack2",
    "Soundtrack3",
    "Soundtrack4",
    "Soundtrack5",
  ];
  lastPlayedMusic: ex.Sound | null = null;

  applySettings(): void {
    for (const key of Object.keys(Sounds) as SoundKey[]) {
      const sound = Sounds[key];
      // The fade owns this track's volume until it finishes.
      if (sound && sound !== this.fadingMusic) sound.volume = audioVolume(this.soundtracks.includes(key) ? "music-volume" : "effects-volume");
    }
  }

  tick() {}

  playBackgroundMusic() {
    if (this.lastPlayedMusic != null) {
      if (this.lastPlayedMusic.isStopped()) {
        this.lastPlayedMusic.stop();
      }
    }
    let sound: ex.Sound;
    do {
      sound = Sounds[random.fromArray(this.soundtracks)];
    } while (sound === this.lastPlayedMusic);

    if (!sound.isLoaded()) {
      sound.load();
      setTimeout(() => {
        this.playBackgroundMusic();
      }, 1000);
      return;
    }
    this.lastPlayedMusic = sound;
    this.applySettings();
    sound.once("playbackend", () => {
      this.playBackgroundMusic();
    });
    this.fadeInMusic(sound);
    sound.play();
  }

  private fadingMusic: ex.Sound | null = null;
  private fadeTimer: ReturnType<typeof setInterval> | null = null;

  /** Ramps a track from silence to the music volume so a late-loading track never starts at full blast. */
  private fadeInMusic(sound: ex.Sound, duration = 3000) {
    if (this.fadeTimer != null) clearInterval(this.fadeTimer);
    this.fadingMusic = sound;
    sound.volume = 0;
    const start = performance.now();
    const step = () => {
      const progress = Math.min(1, (performance.now() - start) / duration);
      // Quadratic ease-in: loudness is perceived logarithmically, so a linear ramp feels like it jumps early.
      sound.volume = audioVolume("music-volume") * progress * progress;
      if (progress >= 1 || this.lastPlayedMusic !== sound) {
        if (this.fadeTimer != null) clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        this.fadingMusic = null;
        if (this.lastPlayedMusic === sound) this.applySettings();
      }
    };
    this.fadeTimer = setInterval(step, 50);
  }
}
