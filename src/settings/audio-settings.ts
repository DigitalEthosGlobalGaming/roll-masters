import { Environment, Settings } from "@src/env";

export type VolumeSetting = "music-volume" | "effects-volume";

export function volumePercent(key: VolumeSetting): number {
  const value: unknown = Environment.get(key);
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.max(0, Math.min(100, value))) : 100;
}

export function audioVolume(key: VolumeSetting): number {
  const mode = Environment.get("sound", Settings.sound.all);
  if (mode === Settings.sound.Off || key === "music-volume" && mode === Settings.sound.nomusic) return 0;
  return volumePercent(key) / 100;
}
