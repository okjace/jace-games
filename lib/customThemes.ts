import { SEASONS, SEASON_FX, type ClickSound, type Motion, type Season, type SeasonFx } from "./seasons";

/**
 * Custom themes people make in the theme maker (and share on the theme
 * market). A custom theme fills in the same parts as the built-in ones:
 * colours, falling things, a garland, hills with props, corner trees, a
 * flyby, a click sound and a music mood, plus optional extra CSS (cleaned:
 * no outside links or imports).
 */

export type TreeKind = "round" | "pine" | "bare" | "palm" | "none";
export type MusicMood = "happy" | "cozy" | "spooky" | "jingly" | "chill" | "hype";

export type ThemeData = {
  name: string;
  icon: string;
  colors: { accent: string; accent2: string; background: string; panel: string; line: string };
  particles: string[];
  motion: Motion;
  density: number;
  garland: string;
  greeting: string;
  hills: [string, string, string];
  props: string[];
  tree: { kind: TreeKind; leaves: string[]; trunk: string; lights: boolean; snow: boolean };
  flyby: string;
  click: ClickSound;
  mood: MusicMood;
  css: string;
};

export type ThemeSummary = {
  id: string;
  owner_id: string;
  owner_name: string;
  name: string;
  icon: string;
  published: boolean;
  installs: number;
  removed: boolean;
  updated_at: string;
  data: ThemeData;
};

export const DEFAULT_THEME: ThemeData = {
  name: "My theme",
  icon: "🎨",
  colors: { accent: "#7c3aed", accent2: "#ec4899", background: "#f5f0ff", panel: "#fffaff", line: "#e4d7f5" },
  particles: ["✨", "💜", "⭐"],
  motion: "drift",
  density: 20,
  garland: "💜✨⭐💖✨💜⭐✨",
  greeting: "welcome to my theme ✨",
  hills: ["#e9d5ff", "#c4b5fd", "#a78bfa"],
  props: ["🌟", "🦄", "🌈", "🍭"],
  tree: { kind: "round", leaves: ["#c084fc", "#f472b6", "#a78bfa"], trunk: "#6b21a8", lights: false, snow: false },
  flyby: "🦄",
  click: "chime",
  mood: "happy",
  css: "",
};

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v: unknown, d: string) => (typeof v === "string" && HEX.test(v) ? v : d);
const text = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.replace(/[<>]/g, "").slice(0, max) : d);
const emojiList = (v: unknown, max: number, d: string[]) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= 12).map((x) => x.replace(/[<>]/g, "")).slice(0, max) : d;
const pick = <T extends string>(v: unknown, ok: readonly T[], d: T): T => (typeof v === "string" && (ok as readonly string[]).includes(v) ? (v as T) : d);

/**
 * Extra CSS, made safe: no links to anything outside (url(), @import), no
 * scripty bits, short, and it can't close the style tag.
 */
export function cleanCss(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let css = raw.slice(0, 6000);
  css = css.replace(/<\/?\s*style/gi, "").replace(/[<>]/g, "");
  css = css.replace(/@import[^;]*;?/gi, "").replace(/@font-face\s*\{[^}]*\}/gi, "");
  css = css.replace(/url\s*\([^)]*\)/gi, "none").replace(/image-set\s*\([^)]*\)/gi, "none");
  css = css.replace(/expression\s*\(/gi, "(").replace(/javascript:/gi, "").replace(/behavior\s*:/gi, "x:").replace(/-moz-binding/gi, "x");
  return css.trim();
}

/** Anything sent from the maker (or the market), made safe and complete. */
export function cleanTheme(raw: unknown): ThemeData {
  const r = (raw ?? {}) as Record<string, unknown>;
  const c = (r.colors ?? {}) as Record<string, unknown>;
  const t = (r.tree ?? {}) as Record<string, unknown>;
  const d = DEFAULT_THEME;
  const hills = Array.isArray(r.hills) ? r.hills : [];
  return {
    name: text(r.name, 40, d.name).trim() || d.name,
    icon: text(r.icon, 12, d.icon).trim() || d.icon,
    colors: {
      accent: hex(c.accent, d.colors.accent),
      accent2: hex(c.accent2, d.colors.accent2),
      background: hex(c.background, d.colors.background),
      panel: hex(c.panel, d.colors.panel),
      line: hex(c.line, d.colors.line),
    },
    particles: emojiList(r.particles, 8, d.particles),
    motion: pick(r.motion, ["fall", "snow", "rise", "twinkle", "drift"] as const, d.motion),
    density: Math.max(0, Math.min(60, Math.round(Number(r.density) || 0))),
    garland: text(r.garland, 120, d.garland),
    greeting: text(r.greeting, 100, d.greeting),
    hills: [hex(hills[0], d.hills[0]), hex(hills[1], d.hills[1]), hex(hills[2], d.hills[2])],
    props: emojiList(r.props, 10, d.props),
    tree: {
      kind: pick(t.kind, ["round", "pine", "bare", "palm", "none"] as const, d.tree.kind),
      leaves: (Array.isArray(t.leaves) ? t.leaves : []).map((x, i) => hex(x, d.tree.leaves[i % 3])).slice(0, 3).concat(d.tree.leaves).slice(0, 3),
      trunk: hex(t.trunk, d.tree.trunk),
      lights: t.lights === true,
      snow: t.snow === true,
    },
    flyby: text(r.flyby, 12, d.flyby),
    click: pick(r.click, ["crunch", "jingle", "spooky", "chime", "pop", "splash", "zap", "boing"] as const, d.click),
    mood: pick(r.mood, ["happy", "cozy", "spooky", "jingly", "chill", "hype"] as const, d.mood),
    css: cleanCss(r.css),
  };
}

/** The CSS that gives the page this theme's colours (plus its own extra CSS). */
export function themeCss(t: ThemeData): string {
  return `:root[data-season="custom"]{--accent:${t.colors.accent};--accent-hover:color-mix(in srgb, ${t.colors.accent} 86%, black);--on-accent:#ffffff;--accent2:${t.colors.accent2};--background:${t.colors.background};--panel:${t.colors.panel};--line:${t.colors.line};}\n${t.css}`;
}

/** Music settings for each mood (the music player's own format). */
export const MOOD_MUSIC: Record<MusicMood, { key: number; minor: boolean; bpm: number; bell: boolean }> = {
  happy: { key: 7, minor: false, bpm: 104, bell: false },
  cozy: { key: 0, minor: false, bpm: 84, bell: false },
  spooky: { key: -3, minor: true, bpm: 78, bell: false },
  jingly: { key: 5, minor: false, bpm: 96, bell: true },
  chill: { key: 4, minor: false, bpm: 76, bell: true },
  hype: { key: -2, minor: true, bpm: 120, bell: false },
};

/**
 * Puts a custom theme where the decorations look for themes: it becomes the
 * "custom" season. (The page shows it with <html data-season="custom">.)
 */
let current: ThemeData | null = null;
/** The custom theme in use right now (for the corner trees and the music). */
export const currentCustom = () => current;

let currentJson = "";
export function registerCustom(t: ThemeData) {
  // Only when it changed, so everything that depends on it doesn't restart on every redraw.
  const json = JSON.stringify(t);
  if (json === currentJson) return;
  currentJson = json;
  current = t;
  const season: Season = { id: "custom" as Season["id"], name: t.name, icon: t.icon, when: "ur own", particles: t.particles, motion: t.motion, density: t.density, garland: t.garland, greeting: t.greeting };
  const fx: SeasonFx = { flyby: t.flyby, flybyPath: "sky", props: t.props, hills: t.hills, click: t.click, scale: [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25], tempo: 480 };
  (SEASONS as Record<string, Season>).custom = season;
  (SEASON_FX as Record<string, SeasonFx>).custom = fx;
}
