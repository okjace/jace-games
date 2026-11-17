import type { LiveMode } from "./live/types";
import type { SeasonId } from "./seasons";
import type { MusicMood } from "./customThemes";

/**
 * Every song on Jace Live: one per site theme, one per game mode, and one per
 * custom-theme mood. A song is a recipe the music player turns into music on
 * the fly: key, scale, speed, a 4-chord loop, instruments, a bass style, a
 * beat, an arpeggio, and a seed that picks its melody (so each song has its
 * own tune that comes back, instead of random notes).
 */

export type ScaleName = "major" | "minor" | "penta" | "minpenta" | "dorian" | "lydian" | "harmonic" | "blues";
export type Beat = "four" | "half" | "break" | "shuffle" | "march" | "none";
export type Song = {
  /** Semitones from C4. */
  key: number;
  scale: ScaleName;
  bpm: number;
  /** Four chord roots, in semitones from the key. */
  loop: number[];
  /** The melody's sound. */
  lead: OscillatorType;
  pad: "warm" | "glass" | "organ" | "bright" | "none";
  bass: "root" | "walk" | "pulse" | "octave" | "none";
  beat: Beat;
  /** Arpeggio over the chord (0 root, 1 third, 2 fifth, 3 octave), one per eighth note; empty = none. */
  arp: number[];
  /** How busy the melody is (0–1). */
  busy: number;
  /** Little bells sparkle on top of the melody. */
  bell: boolean;
  /** Swing (0 = straight, 0.33 = full shuffle). */
  swing?: number;
  /** Picks the melody. */
  seed: number;
};

export const SCALES: Record<ScaleName, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  penta: [0, 2, 4, 7, 9],
  minpenta: [0, 3, 5, 7, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  blues: [0, 3, 5, 6, 7, 10],
};

const UP = [0, 1, 2, 3];
const DOWN = [3, 2, 1, 0];
const BOUNCE = [0, 2, 1, 2];
const ROLL = [0, 1, 2, 3, 2, 1];

export const THEME_SONGS: Record<SeasonId, Song> = {
  plain: { key: 0, scale: "major", bpm: 88, loop: [0, 9, 5, 7], lead: "triangle", pad: "glass", bass: "root", beat: "none", arp: [], busy: 0.4, bell: false, seed: 1 },
  fall: { key: 2, scale: "major", bpm: 84, loop: [0, 7, 9, 5], lead: "triangle", pad: "warm", bass: "walk", beat: "half", arp: ROLL, busy: 0.45, bell: false, swing: 0.15, seed: 2 },
  halloween: { key: -3, scale: "harmonic", bpm: 76, loop: [0, 8, 5, 7], lead: "sine", pad: "organ", bass: "octave", beat: "half", arp: [0, 1, 2, 1], busy: 0.4, bell: false, seed: 3 },
  thanksgiving: { key: 0, scale: "major", bpm: 92, loop: [0, 5, 7, 0], lead: "triangle", pad: "warm", bass: "walk", beat: "shuffle", arp: [], busy: 0.5, bell: false, swing: 0.2, seed: 4 },
  christmas: { key: 5, scale: "major", bpm: 100, loop: [0, 9, 2, 7], lead: "sine", pad: "warm", bass: "walk", beat: "shuffle", arp: [], busy: 0.55, bell: true, swing: 0.25, seed: 5 },
  winter: { key: 3, scale: "lydian", bpm: 72, loop: [0, 5, 9, 7], lead: "sine", pad: "glass", bass: "root", beat: "none", arp: ROLL, busy: 0.35, bell: true, seed: 6 },
  newyear: { key: 7, scale: "major", bpm: 122, loop: [0, 7, 9, 5], lead: "square", pad: "bright", bass: "pulse", beat: "four", arp: UP, busy: 0.55, bell: true, seed: 7 },
  lunar: { key: 2, scale: "penta", bpm: 92, loop: [0, 9, 7, 5], lead: "triangle", pad: "glass", bass: "root", beat: "half", arp: BOUNCE, busy: 0.5, bell: true, seed: 8 },
  valentines: { key: 5, scale: "major", bpm: 80, loop: [0, 9, 5, 7], lead: "sine", pad: "warm", bass: "root", beat: "half", arp: ROLL, busy: 0.4, bell: false, swing: 0.1, seed: 9 },
  stpatricks: { key: 2, scale: "dorian", bpm: 116, loop: [0, 10, 0, 7], lead: "square", pad: "none", bass: "octave", beat: "shuffle", arp: [], busy: 0.7, bell: false, swing: 0.33, seed: 10 },
  spring: { key: 7, scale: "major", bpm: 98, loop: [0, 5, 9, 7], lead: "triangle", pad: "glass", bass: "root", beat: "half", arp: BOUNCE, busy: 0.5, bell: true, seed: 11 },
  easter: { key: 5, scale: "major", bpm: 104, loop: [0, 5, 7, 5], lead: "sine", pad: "glass", bass: "octave", beat: "shuffle", arp: [], busy: 0.55, bell: true, swing: 0.2, seed: 12 },
  earth: { key: 0, scale: "penta", bpm: 88, loop: [0, 9, 5, 7], lead: "triangle", pad: "warm", bass: "walk", beat: "half", arp: ROLL, busy: 0.45, bell: false, seed: 13 },
  summer: { key: 9, scale: "major", bpm: 108, loop: [0, 7, 9, 5], lead: "triangle", pad: "organ", bass: "walk", beat: "half", arp: [], busy: 0.5, bell: false, swing: 0.15, seed: 14 },
  july4: { key: 7, scale: "major", bpm: 116, loop: [0, 5, 7, 0], lead: "square", pad: "bright", bass: "octave", beat: "march", arp: UP, busy: 0.55, bell: false, seed: 15 },
  school: { key: 0, scale: "major", bpm: 100, loop: [0, 7, 9, 5], lead: "square", pad: "none", bass: "pulse", beat: "four", arp: UP, busy: 0.5, bell: false, seed: 16 },
  space: { key: -1, scale: "minor", bpm: 70, loop: [0, 8, 3, 10], lead: "sine", pad: "glass", bass: "root", beat: "none", arp: ROLL, busy: 0.35, bell: true, seed: 17 },
  ocean: { key: 4, scale: "major", bpm: 74, loop: [0, 5, 9, 5], lead: "sine", pad: "warm", bass: "root", beat: "none", arp: ROLL, busy: 0.35, bell: true, seed: 18 },
  candy: { key: 7, scale: "major", bpm: 124, loop: [0, 9, 5, 7], lead: "square", pad: "glass", bass: "octave", beat: "four", arp: BOUNCE, busy: 0.6, bell: true, seed: 19 },
  neon: { key: -2, scale: "minor", bpm: 118, loop: [0, 8, 3, 10], lead: "sawtooth", pad: "warm", bass: "pulse", beat: "four", arp: [0, 1, 2, 3, 2, 1, 2, 3], busy: 0.5, bell: false, seed: 20 },
  retro: { key: 0, scale: "major", bpm: 132, loop: [0, 5, 7, 5], lead: "square", pad: "none", bass: "octave", beat: "four", arp: UP, busy: 0.6, bell: false, seed: 21 },
} as Record<SeasonId, Song>;

/** Custom themes pick a mood; each mood borrows a theme's song (in its own key). */
export const MOOD_SONGS: Record<MusicMood, Song> = {
  happy: { ...THEME_SONGS.spring, key: 7, seed: 31 },
  cozy: { ...THEME_SONGS.fall, key: 0, seed: 32 },
  spooky: { ...THEME_SONGS.halloween, key: -5, seed: 33 },
  jingly: { ...THEME_SONGS.christmas, key: 3, seed: 34 },
  chill: { ...THEME_SONGS.ocean, key: 2, seed: 35 },
  hype: { ...THEME_SONGS.neon, key: 0, seed: 36 },
};

const MAJ = [0, 7, 9, 5];
const MIN = [0, 8, 3, 10];
let n = 100;
const game = (key: number, minor: boolean, bpm: number, lead: OscillatorType, beat: Beat, arp: number[], busy: number, bell: boolean, loop?: number[], swing = 0): Song => ({
  key,
  scale: minor ? "minor" : "major",
  bpm,
  loop: loop ?? (minor ? MIN : MAJ),
  lead,
  pad: minor ? "warm" : "bright",
  bass: beat === "shuffle" ? "walk" : beat === "march" ? "octave" : "pulse",
  beat,
  arp,
  busy,
  bell,
  swing,
  seed: n++,
});

export const GAME_SONGS: Record<LiveMode, Song> = {
  classic: game(0, false, 118, "triangle", "four", UP, 0.6, false),
  gold: game(2, false, 112, "square", "shuffle", BOUNCE, 0.65, true, undefined, 0.2),
  rocket: game(7, false, 140, "sawtooth", "break", UP, 0.7, false),
  tower: game(-3, true, 124, "square", "march", DOWN, 0.55, false),
  snack: game(5, false, 116, "sine", "shuffle", BOUNCE, 0.55, true, undefined, 0.2),
  factory: game(-2, false, 128, "square", "four", [0, 0, 2, 0, 3, 0, 2, 0], 0.5, false),
  fishing: game(4, false, 92, "sine", "half", ROLL, 0.4, true),
  hack: game(-1, true, 132, "sawtooth", "break", [0, 3, 1, 3, 2, 3, 1, 3], 0.6, false, [0, 8, 5, 7]),
  baseball: game(7, false, 120, "triangle", "march", UP, 0.55, false, [0, 5, 7, 5]),
  custom: game(3, false, 116, "triangle", "four", BOUNCE, 0.55, false),
  banana: game(9, false, 126, "square", "shuffle", [0, 2, 3, 2], 0.7, true, undefined, 0.25),
  summit: game(2, false, 108, "triangle", "march", UP, 0.5, true, [0, 5, 9, 7]),
  survival: game(-4, true, 120, "sawtooth", "march", DOWN, 0.45, false),
  boss: game(-5, true, 146, "sawtooth", "break", [0, 1, 0, 2, 0, 3, 0, 2], 0.6, false, [0, 1, 0, 10]),
  tug: game(0, false, 136, "square", "four", [0, 3, 0, 3], 0.6, false),
  hatchery: game(5, false, 100, "sine", "half", ROLL, 0.5, true),
  pinata: game(7, false, 130, "square", "shuffle", BOUNCE, 0.7, true, [0, 5, 7, 0], 0.2),
  rare: game(4, false, 110, "triangle", "half", [0, 2, 3, 1], 0.55, true),
  territory: game(-2, true, 122, "square", "march", UP, 0.5, false),
  vault: game(1, true, 104, "triangle", "shuffle", [0, 1, 2, 1], 0.45, false, undefined, 0.15),
  king: game(0, false, 118, "sawtooth", "march", [0, 2, 3, 2], 0.55, true, [0, 5, 7, 7]),
  memory: game(9, false, 96, "sine", "half", ROLL, 0.45, true),
  sweep: game(-3, true, 112, "triangle", "four", DOWN, 0.5, false),
  stack: game(6, false, 124, "square", "four", UP, 0.6, false),
  snake: game(-1, true, 138, "sawtooth", "break", [0, 2, 3, 2, 1, 2, 3, 2], 0.5, false),
  mparty: game(2, false, 106, "sine", "shuffle", BOUNCE, 0.5, true, undefined, 0.2),
  beacon: game(-4, true, 128, "sawtooth", "march", [0, 3, 2, 3, 0, 3, 1, 3], 0.5, false),
  flag: game(3, false, 134, "square", "break", UP, 0.55, true, [0, 5, 7, 5]),
  sled: game(5, false, 138, "square", "four", [0, 2, 3, 2, 1, 2, 3, 2], 0.6, true, [0, 5, 9, 7]),
};

// ---------- Melodies ----------

/** A tiny seeded random number maker (the same seed always gives the same tune). */
function rng(seed: number) {
  let a = seed * 2654435761;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One step of a melody: play or rest, which scale step (from the chord's root), and how long (in eighths). */
export type Note = { deg: number; len: number } | null;

/**
 * A song's tune: phrases A, A (with a new ending), B, A, each two bars of
 * eighth notes. Notes land more on the beat, move mostly by step, and each
 * phrase ends home on the chord.
 */
export function melodyOf(song: Song): Note[][] {
  const r = rng(song.seed);
  const phrase = (density: number): Note[] => {
    const out: Note[] = [];
    let deg = Math.floor(r() * 3);
    for (let i = 0; i < 16; ) {
      const strong = i % 4 === 0;
      const chance = strong ? 0.55 + density * 0.4 : density * 0.75;
      if (r() < chance) {
        const len = r() < 0.25 ? (strong ? 3 : 2) : 1;
        out.push({ deg, len });
        for (let k = 1; k < len && i + k < 16; k++) out.push(null);
        i += len;
        // Mostly steps, sometimes a little leap.
        const move = r() < 0.7 ? (r() < 0.5 ? -1 : 1) : Math.round((r() - 0.5) * 6);
        deg = Math.max(-2, Math.min(7, deg + move));
      } else {
        out.push(null);
        i++;
      }
    }
    // End on the chord (root or fifth), held.
    out[12] = { deg: r() < 0.5 ? 0 : 4, len: 4 };
    out[13] = out[14] = out[15] = null;
    return out.slice(0, 16);
  };
  const a = phrase(song.busy);
  const a2 = a.slice(0, 10).concat(phrase(song.busy).slice(10));
  const b = phrase(Math.min(1, song.busy + 0.15)).map((x) => (x ? { ...x, deg: x.deg + 2 } : x));
  return [a, a2, b, a];
}

export const scaleNote = (scale: number[], idx: number) => scale[((idx % scale.length) + scale.length) % scale.length] + 12 * Math.floor(idx / scale.length);

/** The scale step closest to a pitch (in semitones from the key). */
export function nearestStep(scale: number[], semis: number): number {
  let best = 0;
  let bd = Infinity;
  for (let i = -21; i <= 28; i++) {
    const d = Math.abs(scaleNote(scale, i) - semis);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/** A chord's third and fifth, kept inside the song's scale. */
export function chordOf(scale: number[], root: number): [number, number, number, number] {
  const has = (n: number) => scale.includes(((n % 12) + 12) % 12);
  const third = has(root + 4) ? root + 4 : has(root + 3) ? root + 3 : root + 4;
  const fifth = has(root + 7) ? root + 7 : has(root + 6) ? root + 6 : root + 7;
  return [root, third, fifth, root + 12];
}

/**
 * Every theme's and mood's song, recorded ahead of time (3 min MP3s on a
 * GitHub release of this site's repo), so downloading it is instant.
 * Made with scripts/record-theme-songs (re-record when songs change and bump the tag).
 */
export const SONG_FILES = "https://github.com/okjace/jace-games/releases/download/theme-songs-v1";
export const songFileName = (id: string) => `jace-live-${id}.mp3`;
