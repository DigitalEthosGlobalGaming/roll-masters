import { SoundPaths, Sounds } from "@src/resources";
import type { SoundKey } from "@src/resources";
import { random } from "@src/utility/random";
import { Environment, Settings } from "@src/env";
import * as ex from "excalibur";
import { audioVolume } from "@src/settings/audio-settings";
export class SoundManager {
  static _instance: SoundManager | null = null;
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
      if (sound) sound.volume = audioVolume(this.soundtracks.includes(key) ? "music-volume" : "effects-volume");
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
    sound.play();
  }
}
