"use client";

import { useSyncExternalStore } from "react";

/**
 * How loud Jace Live is, remembered on this device: one slider for sound
 * effects (game sounds, click sounds) and one for the background music.
 * 0 means off.
 */
export type AudioSettings = { sfx: number; music: number };

const KEY = "jace-live:audio";
const DEFAULTS: AudioSettings = { sfx: 0.8, music: 0.35 };
const subs = new Set<() => void>();
let cache: AudioSettings | null = null;

export function getAudio(): AudioSettings {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<AudioSettings> | null;
    cache = {
      sfx: typeof raw?.sfx === "number" ? Math.min(1, Math.max(0, raw.sfx)) : DEFAULTS.sfx,
      music: typeof raw?.music === "number" ? Math.min(1, Math.max(0, raw.music)) : DEFAULTS.music,
    };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function setAudio(patch: Partial<AudioSettings>) {
  cache = { ...getAudio(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {}
  subs.forEach((f) => f());
}

export function useAudio(): AudioSettings {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    getAudio,
    () => DEFAULTS,
  );
}
