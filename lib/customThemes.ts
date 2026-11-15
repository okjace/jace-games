import { UPLOAD_PATH } from "./live/media";
import { SEASONS, SEASON_FX, type ClickSound, type Motion, type Season, type SeasonFx } from "./seasons";

/**
 * Custom themes people make in the theme maker (and share on the theme
 * market). A custom theme fills in the same parts as the built-in ones:
 * colours, falling things, a garland, hills with props, corner trees, a
 * flyby, a click sound and a music mood, plus optional extra CSS (cleaned:
 * no outside links or imports).
 */

export type TreeKind = "round" | "pine" | "bare" | "palm" | "none";
export type FontPick = "default" | "rounded" | "comic" | "serif" | "mono" | "fancy" | "chunky";
/** The parts of the page decorations a theme can switch off. */
export const SHOW_PARTS = ["garland", "hills", "props", "trees", "pattern", "wash", "sparkles", "flyby", "falling"] as const;
export type ShowPart = (typeof SHOW_PARTS)[number];

/** Fonts a theme can pick (all already on people's devices, nothing downloaded). */
export const FONTS: Record<FontPick, { name: string; stack: string }> = {
  default: { name: "normal", stack: "" },
  rounded: { name: "rounded", stack: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif' },
  comic: { name: "comic", stack: '"Comic Sans MS", "Comic Neue", "Chalkboard SE", cursive' },
  serif: { name: "fancy serif", stack: 'Georgia, "Times New Roman", serif' },
  mono: { name: "typewriter", stack: 'ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace' },
  fancy: { name: "handwritten", stack: '"Segoe Script", "Bradley Hand", "Brush Script MT", cursive' },
  chunky: { name: "chunky", stack: 'Impact, "Arial Black", "Haettenschweiler", sans-serif' },
};
export type MusicMood = "happy" | "cozy" | "spooky" | "jingly" | "chill" | "hype";

export type ThemeData = {
  name: string;
  icon: string;
  colors: { accent: string; accent2: string; background: string; panel: string; line: string; text: string; muted: string };
  /** Colours used in dark mode (null = made automatically from the light ones). */
  dark: { background: string; panel: string; line: string; text: string } | null;
  fonts: { body: FontPick; heading: FontPick };
  /** Corner roundness: 0 = square, 1 = normal, 2 = extra round. */
  round: number;
  /** Falling things: size (0.5–2) and speed (0.3–3). */
  particleSize: number;
  particleSpeed: number;
  /** Decorations switched on (anything missing is on). */
  show: Record<ShowPart, boolean>;
  flybyPath: "sky" | "ground";
  /** The theme's own music (an uploaded file's path) or "" for made-up music in `mood`. */
  music: string;
  /** A background picture (an uploaded file's path) or "". */
  bgImage: string;
  /** How see-through the background picture is (0.1–1). */
  bgOpacity: number;
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
  colors: { accent: "#7c3aed", accent2: "#ec4899", background: "#f5f0ff", panel: "#fffaff", line: "#e4d7f5", text: "#1b1d23", muted: "#5d6470" },
  dark: null,
  fonts: { body: "default", heading: "default" },
  round: 1,
  particleSize: 1,
  particleSpeed: 1,
  show: { garland: true, hills: true, props: true, trees: true, pattern: true, wash: true, sparkles: true, flyby: true, falling: true },
  flybyPath: "sky",
  music: "",
  bgImage: "",
  bgOpacity: 0.35,
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
const num = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Number(v);
  return v === undefined || v === null || !Number.isFinite(n) ? d : Math.max(lo, Math.min(hi, Math.round(n * 100) / 100));
};
const FONT_IDS = Object.keys(FONTS) as FontPick[];
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
  const f = (r.fonts ?? {}) as Record<string, unknown>;
  const sh = (r.show ?? {}) as Record<string, unknown>;
  const dk = r.dark as Record<string, unknown> | null | undefined;
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
      text: hex(c.text, d.colors.text),
      muted: hex(c.muted, d.colors.muted),
    },
    dark: dk && typeof dk === "object" ? { background: hex(dk.background, "#121318"), panel: hex(dk.panel, "#1a1c23"), line: hex(dk.line, "#2b2e38"), text: hex(dk.text, "#eceef2") } : null,
    fonts: { body: pick(f.body, FONT_IDS, "default"), heading: pick(f.heading, FONT_IDS, "default") },
    round: num(r.round, 0, 2, 1),
    particleSize: num(r.particleSize, 0.5, 2, 1),
    particleSpeed: num(r.particleSpeed, 0.3, 3, 1),
    show: Object.fromEntries(SHOW_PARTS.map((k) => [k, sh[k] !== false])) as Record<ShowPart, boolean>,
    flybyPath: pick(r.flybyPath, ["sky", "ground"] as const, "sky"),
    music: typeof r.music === "string" && UPLOAD_PATH.test(r.music) && /\.(mp3|ogg|wav|m4a)$/.test(r.music) ? r.music : "",
    bgImage: typeof r.bgImage === "string" && UPLOAD_PATH.test(r.bgImage) && /\.(png|jpg|gif|webp)$/.test(r.bgImage) ? r.bgImage : "",
    bgOpacity: num(r.bgOpacity, 0.1, 1, 0.35),
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

/** The CSS that gives the page this theme's look (colours, fonts, corners, what's shown) plus its own extra CSS. */
export function themeCss(t: ThemeData): string {
  const R = ':root[data-season="custom"]';
  const c = t.colors;
  const out = [`${R}{--accent:${c.accent};--accent-hover:color-mix(in srgb, ${c.accent} 86%, black);--on-accent:#ffffff;--accent2:${c.accent2};--background:${c.background};--panel:${c.panel};--line:${c.line};--foreground:${c.text};--muted:${c.muted};}`];
  // Dark mode: the theme's own dark colours, or ones made from its accent.
  const D = `${R}[data-theme="dark"]`;
  if (t.dark) out.push(`${D}{--background:${t.dark.background};--panel:${t.dark.panel};--line:${t.dark.line};--foreground:${t.dark.text};--muted:color-mix(in srgb, ${t.dark.text} 68%, ${t.dark.background});}`);
  else out.push(`${D}{--background:color-mix(in srgb, ${c.accent} 9%, #0c0d11);--panel:color-mix(in srgb, ${c.accent} 11%, #16171d);--line:color-mix(in srgb, ${c.accent} 24%, #272a33);--foreground:#eceef2;--muted:#a3a9b4;}`);
  if (t.fonts.body !== "default") out.push(`${R} body, ${R} button, ${R} input, ${R} select, ${R} textarea{font-family:${FONTS[t.fonts.body].stack};}`);
  if (t.fonts.heading !== "default") out.push(`${R} .font-display, ${R} h1, ${R} h2{font-family:${FONTS[t.fonts.heading].stack};}`);
  if (t.round !== 1) {
    // Squarer or rounder corners on cards and buttons (fully round pills stay round).
    const k = t.round;
    out.push(`${R} .rounded-xl{border-radius:${0.75 * k}rem}${R} .rounded-2xl{border-radius:${1 * k}rem}${R} .rounded-3xl{border-radius:${1.5 * k}rem}${R} .rounded-lg{border-radius:${0.5 * k}rem}`);
    if (k < 0.3) out.push(`${R} .rounded-full:not(.h-3):not(.w-3){border-radius:${k * 2}rem}`);
  }
  const hide: Record<ShowPart, string> = {
    garland: '[data-egg="garland"]',
    hills: ".jl-backdrop svg",
    props: ".jl-prop",
    trees: ".jl-tree",
    pattern: ".jl-pattern",
    wash: ".jl-wash",
    sparkles: ".jl-trail",
    flyby: ".jl-flyby",
    falling: ".jl-sky",
  };
  const off = SHOW_PARTS.filter((k) => !t.show[k]).map((k) => `${R} ${hide[k]}`);
  if (off.length) out.push(`${off.join(",")}{display:none !important}`);
  if (t.bgImage) out.push(`${R} .jl-backdrop::before{content:"";position:absolute;inset:0;background:url("/api/live/media/${t.bgImage}") center/cover no-repeat;opacity:${t.bgOpacity};}`);
  out.push(t.css);
  return out.join("\n");
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
  const fx: SeasonFx = { flyby: t.flyby, flybyPath: t.flybyPath, props: t.props, hills: t.hills, click: t.click, scale: [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25], tempo: 480 };
  (SEASONS as Record<string, Season>).custom = season;
  (SEASON_FX as Record<string, SeasonFx>).custom = fx;
}
