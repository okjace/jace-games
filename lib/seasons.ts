/**
 * Site themes for Jace Live: holidays and seasons with their own colours,
 * things drifting across the screen, a garland under the menu bar and a
 * home-page greeting. "auto" picks one by the date; the site owner can pin
 * any theme (or "plain") for everyone from their profile settings.
 */

export type SeasonId =
  | "plain"
  | "fall"
  | "halloween"
  | "thanksgiving"
  | "christmas"
  | "winter"
  | "newyear"
  | "lunar"
  | "valentines"
  | "stpatricks"
  | "spring"
  | "easter"
  | "earth"
  | "summer"
  | "july4"
  | "school"
  | "space"
  | "ocean"
  | "candy"
  | "neon"
  | "retro";

export type ThemeChoice = "auto" | SeasonId;

/** How the decorations move: falling and swaying, drifting up, or twinkling in place. */
export type Motion = "fall" | "snow" | "rise" | "twinkle" | "drift";

export type Season = {
  id: SeasonId;
  name: string;
  icon: string;
  /** When it shows on its own (for the picker). */
  when: string;
  /** Things that drift across the page. */
  particles: string[];
  motion: Motion;
  /** Roughly how many on screen at once on a big screen. */
  density: number;
  /** A row of emoji under the menu bar. */
  garland: string;
  /** The home page greeting. */
  greeting: string;
};

export const SEASONS: Record<SeasonId, Season> = {
  plain: { id: "plain", name: "Plain", icon: "⚪", when: "Never on its own", particles: [], motion: "fall", density: 0, garland: "", greeting: "" },
  fall: {
    id: "fall",
    name: "Fall",
    icon: "🍂",
    when: "September to November",
    particles: ["🍂", "🍁", "🍂", "🍁", "🌰", "🍃"],
    motion: "fall",
    density: 26,
    garland: "🍁🍂🍃🌰🍁🍂🎃🍁🍂🍃🌰🍁🍂🍎🍁🍂🍃🌰🍁🍂🌽🍁🍂🍃",
    greeting: "its cozy szn 🍂 grab a cider n host a game",
  },
  halloween: {
    id: "halloween",
    name: "Halloween",
    icon: "🎃",
    when: "October 15–31",
    particles: ["🎃", "👻", "🦇", "🕸️", "🍬", "🦇"],
    motion: "drift",
    density: 22,
    garland: "🎃🦇👻🕸️🍬🎃🦇💀🕷️🍭🎃🦇👻🕸️🍬🎃🦇🧙🕷️🍭",
    greeting: "spooky szn!! 👻 trick or quiz??",
  },
  thanksgiving: {
    id: "thanksgiving",
    name: "Thanksgiving",
    icon: "🦃",
    when: "The week of Thanksgiving",
    particles: ["🦃", "🍂", "🥧", "🌽", "🍁", "🍂"],
    motion: "fall",
    density: 24,
    garland: "🦃🍂🥧🌽🍁🍂🦃🍠🍁🍂🥧🌽🦃🍂🍁🥖🦃🍂🥧🌽",
    greeting: "happy thanksgiving 🦃 thankful for u, quiz champ",
  },
  christmas: {
    id: "christmas",
    name: "Christmas",
    icon: "🎄",
    when: "December 1–27",
    particles: ["❄️", "❅", "❆", "❄️", "⭐", "🎁"],
    motion: "snow",
    density: 40,
    garland: "🎄🎁⭐🔔❄️🎅🎄🍪🦌🎁⭐🔔❄️🧦🎄🎁⭐🔔❄️⛄🎄🍬",
    greeting: "merry christmas!! 🎄 ho ho HOST a game",
  },
  winter: {
    id: "winter",
    name: "Winter",
    icon: "⛄",
    when: "January to mid-March",
    particles: ["❄️", "❅", "❆", "❄️"],
    motion: "snow",
    density: 36,
    garland: "❄️⛄🧣❄️☕🧤❄️⛄🧣❄️☕🧤❄️⛄🧣❄️☕🧤",
    greeting: "brrr ☕ perfect day for a quiz tbh",
  },
  newyear: {
    id: "newyear",
    name: "New Year",
    icon: "🎆",
    when: "December 28 to January 5",
    particles: ["✨", "🎉", "🎊", "⭐", "🥳", "🎆"],
    motion: "twinkle",
    density: 30,
    garland: "🎆🎉🥂✨🎊🕛🎆🎉🥳✨🎊🎆🎉🥂✨🎊🕛🎆",
    greeting: "happy new year 🎆 new year, new high scores",
  },
  lunar: {
    id: "lunar",
    name: "Lunar New Year",
    icon: "🧧",
    when: "Around Lunar New Year",
    particles: ["🧧", "🏮", "✨", "🧨", "🐉"],
    motion: "drift",
    density: 20,
    garland: "🏮🧧🐉🏮🧨✨🏮🧧🐉🏮🧨✨🏮🧧🐉🏮",
    greeting: "happy lunar new year 🧧 good luck in evry game",
  },
  valentines: {
    id: "valentines",
    name: "Valentine's",
    icon: "💖",
    when: "February 7–15",
    particles: ["💖", "💕", "💘", "🌹", "💗", "💌"],
    motion: "rise",
    density: 26,
    garland: "💖💕🌹💘💗💌🍫💖💕🌹💘💗💌🍫💖💕🌹",
    greeting: "luv is in the air 💖 host a game w ur favorite ppl",
  },
  stpatricks: {
    id: "stpatricks",
    name: "St. Patrick's",
    icon: "☘️",
    when: "March 12–17",
    particles: ["☘️", "🍀", "🌈", "🪙", "☘️"],
    motion: "fall",
    density: 26,
    garland: "☘️🍀🌈🪙☘️🎩🍀🌈🪙☘️🍀🌈🪙☘️🎩🍀",
    greeting: "feelin lucky?? 🍀 go for gold",
  },
  spring: {
    id: "spring",
    name: "Spring",
    icon: "🌸",
    when: "Late March to June",
    particles: ["🌸", "🌼", "🦋", "🌷", "🌸", "🐝"],
    motion: "drift",
    density: 22,
    garland: "🌸🌷🌼🦋🌱🐝🌸🌷🌼🦋🌱🐝🌸🌷🌼🦋🌱",
    greeting: "spring is bloomin 🌸 fresh sets, fresh games",
  },
  easter: {
    id: "easter",
    name: "Easter",
    icon: "🐣",
    when: "The week before Easter",
    particles: ["🥚", "🐣", "🌷", "🐰", "🥚", "🌼"],
    motion: "fall",
    density: 22,
    garland: "🐣🥚🌷🐰🥕🌼🐣🥚🌷🐰🥕🌼🐣🥚🌷🐰",
    greeting: "happy easter 🐣 hunt for the right answers",
  },
  earth: {
    id: "earth",
    name: "Earth Day",
    icon: "🌎",
    when: "April 20–23",
    particles: ["🌱", "🍃", "🌎", "♻️", "🌳"],
    motion: "drift",
    density: 20,
    garland: "🌎🌱🌳♻️🍃🐢🌎🌱🌳♻️🍃🐢🌎🌱🌳",
    greeting: "happy earth day 🌎 quizes are 100% recyclable",
  },
  summer: {
    id: "summer",
    name: "Summer",
    icon: "☀️",
    when: "Late June to mid-August",
    particles: ["☀️", "🌴", "🍉", "🏖️", "🍦", "🫧"],
    motion: "rise",
    density: 18,
    garland: "☀️🌴🍉🏖️🍦🕶️🌊☀️🌴🍉🏖️🍦🕶️🌊☀️🌴",
    greeting: "summer vibes ☀️ whos up for a game",
  },
  july4: {
    id: "july4",
    name: "July 4th",
    icon: "🎆",
    when: "July 1–5",
    particles: ["🎆", "🎇", "⭐", "✨", "🇺🇸"],
    motion: "twinkle",
    density: 28,
    garland: "🇺🇸🎆⭐🎇🦅✨🇺🇸🎆⭐🎇🦅✨🇺🇸🎆⭐",
    greeting: "happy 4th!! 🎆 light up the leaderboard",
  },
  school: {
    id: "school",
    name: "Back to School",
    icon: "🎒",
    when: "Mid-August to early September",
    particles: ["✏️", "📚", "🍎", "📐", "🎒", "📝"],
    motion: "fall",
    density: 18,
    garland: "🎒✏️📚🍎📐📝🖍️🎒✏️📚🍎📐📝🖍️🎒✏️",
    greeting: "back to skool 🎒 study up w a game",
  },
  space: {
    id: "space",
    name: "Space",
    icon: "🚀",
    when: "Only when picked",
    particles: ["⭐", "✨", "🪐", "☄️", "🚀", "🌟"],
    motion: "twinkle",
    density: 34,
    garland: "🚀🪐⭐🌙☄️👽🛸🚀🪐⭐🌙☄️👽🛸🚀",
    greeting: "to infinity n beyond 🚀",
  },
  ocean: {
    id: "ocean",
    name: "Ocean",
    icon: "🌊",
    when: "Only when picked",
    particles: ["🫧", "🐠", "🫧", "🐚", "🫧", "🐙"],
    motion: "rise",
    density: 26,
    garland: "🌊🐠🐚🐙🦀🐳🐬🌊🐠🐚🐙🦀🐳🐬🌊",
    greeting: "dive in 🌊 the waters fine",
  },
  candy: {
    id: "candy",
    name: "Candy Land",
    icon: "🍭",
    when: "Only when picked",
    particles: ["🍭", "🍬", "🍩", "🧁", "🍫", "🍡"],
    motion: "fall",
    density: 26,
    garland: "🍭🍬🍩🧁🍫🍡🍰🍭🍬🍩🧁🍫🍡🍰🍭",
    greeting: "sweet games ahead 🍭 (no cavitys)",
  },
  neon: {
    id: "neon",
    name: "Neon Night",
    icon: "🌃",
    when: "Only when picked",
    particles: ["✦", "✧", "★", "✦", "◆"],
    motion: "twinkle",
    density: 36,
    garland: "",
    greeting: "lights UP 🌃",
  },
  retro: {
    id: "retro",
    name: "Retro Arcade",
    icon: "👾",
    when: "Only when picked",
    particles: ["👾", "🕹️", "⭐", "💾", "👾"],
    motion: "drift",
    density: 18,
    garland: "👾🕹️💾📼👾🕹️💾📼👾🕹️💾📼👾",
    greeting: "insert coin 👾",
  },
};

export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[];
export const isSeasonId = (v: unknown): v is SeasonId => typeof v === "string" && v in SEASONS;
export const isThemeChoice = (v: unknown): v is ThemeChoice => v === "auto" || isSeasonId(v);

/** Easter Sunday (Gregorian), as [month 0–11, day]. */
function easter(y: number): [number, number] {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month - 1, day];
}

/** Lunar New Year's day for the years around now. */
const LUNAR: Record<number, [number, number]> = {
  2025: [0, 29],
  2026: [1, 17],
  2027: [1, 6],
  2028: [0, 26],
  2029: [1, 13],
  2030: [1, 3],
};

const dayOfYear = (y: number, m: number, d: number) => Math.round((Date.UTC(y, m, d) - Date.UTC(y, 0, 1)) / 86_400_000);

/** The theme for a date (in US Eastern time by default, since that's where most players are). */
export function seasonFor(date: Date = new Date(), timeZone = "America/New_York"): SeasonId {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const y = get("year");
  const m = get("month") - 1;
  const d = get("day");
  const today = dayOfYear(y, m, d);
  const near = (mm: number, dd: number, before: number, after: number) => {
    const t = dayOfYear(y, mm, dd);
    return today >= t - before && today <= t + after;
  };
  const between = (m1: number, d1: number, m2: number, d2: number) => today >= dayOfYear(y, m1, d1) && today <= dayOfYear(y, m2, d2);

  // Holidays first, then the seasons around them.
  if (between(11, 28, 11, 31) || between(0, 1, 0, 5)) return "newyear";
  if (LUNAR[y] && near(LUNAR[y][0], LUNAR[y][1], 3, 7)) return "lunar";
  if (between(1, 7, 1, 15)) return "valentines";
  if (between(2, 12, 2, 17)) return "stpatricks";
  const [em, ed] = easter(y);
  if (near(em, ed, 7, 1)) return "easter";
  if (between(3, 20, 3, 23)) return "earth";
  if (between(6, 1, 6, 5)) return "july4";
  if (between(9, 15, 9, 31)) return "halloween";
  // Thanksgiving: the fourth Thursday of November.
  const nov1 = new Date(Date.UTC(y, 10, 1)).getUTCDay();
  const thanks = 1 + ((4 - nov1 + 7) % 7) + 21;
  if (near(10, thanks, 5, 2)) return "thanksgiving";
  if (between(11, 1, 11, 27)) return "christmas";
  if (between(0, 6, 2, 19)) return "winter";
  if (between(2, 20, 5, 20)) return "spring";
  if (between(5, 21, 7, 14)) return "summer";
  if (between(7, 15, 8, 7)) return "school";
  return "fall";
}

export function activeSeason(choice: ThemeChoice, date?: Date): SeasonId {
  return choice === "auto" ? seasonFor(date) : choice;
}

// ---------- Extra theme effects ----------

/** The little sound every click makes in a theme. */
export type ClickSound = "crunch" | "jingle" | "spooky" | "chime" | "pop" | "splash" | "zap" | "boing";

export type SeasonFx = {
  /** Something big that crosses the screen now and then. */
  flyby: string;
  /** Flybys run along the ground, or fly through the sky. */
  flybyPath: "ground" | "sky";
  /** Things standing on the hills at the bottom of the page. */
  props: string[];
  /** Hill colours, back to front. */
  hills: [string, string, string];
  click: ClickSound;
  /** The notes the theme tune wanders over (Hz). */
  scale: number[];
  /** Tune speed: ms between notes. */
  tempo: number;
};

const PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25];
const MINOR = [220, 261.63, 293.66, 329.63, 349.23, 440, 523.25];
const BELLS = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66];

export const SEASON_FX: Record<SeasonId, SeasonFx> = {
  plain: { flyby: "", flybyPath: "sky", props: [], hills: ["#e5e7eb", "#d1d5db", "#cbd5e1"], click: "pop", scale: PENTA, tempo: 600 },
  fall: { flyby: "🦃", flybyPath: "ground", props: ["🎃", "🌾", "🍄", "🎃", "🌳", "🦔", "🍎", "🌾", "🎃", "🍂"], hills: ["#f6c48b", "#e9925a", "#c8642e"], click: "crunch", scale: PENTA, tempo: 520 },
  halloween: { flyby: "🧙", flybyPath: "sky", props: ["🎃", "🪦", "🕯️", "🎃", "🏚️", "🪦", "🎃", "🕷️", "🌕", "🎃"], hills: ["#c9b2e6", "#8e6bb8", "#4f3a72"], click: "spooky", scale: MINOR, tempo: 700 },
  thanksgiving: { flyby: "🦃", flybyPath: "ground", props: ["🌽", "🥧", "🎃", "🌾", "🦃", "🍂", "🌽", "🥖", "🌾", "🍁"], hills: ["#f3c27a", "#d98b3a", "#a85a1e"], click: "crunch", scale: PENTA, tempo: 560 },
  christmas: { flyby: "🛷", flybyPath: "sky", props: ["🎄", "⛄", "🎁", "🎄", "🏠", "🦌", "🎄", "🎁", "⛄", "🎄"], hills: ["#ffffff", "#e3f0f7", "#cfe3ee"], click: "jingle", scale: BELLS, tempo: 380 },
  winter: { flyby: "🐧", flybyPath: "ground", props: ["⛄", "🌲", "🏔️", "🌲", "⛄", "🐻‍❄️", "🌲", "🏔️"], hills: ["#ffffff", "#e6f1fa", "#d3e4f3"], click: "jingle", scale: BELLS, tempo: 480 },
  newyear: { flyby: "🎆", flybyPath: "sky", props: ["🥂", "🎉", "🍾", "🎊", "🏙️", "🎉", "🥳", "🍾"], hills: ["#e9e2c4", "#cdb978", "#9b8a4a"], click: "chime", scale: BELLS, tempo: 300 },
  lunar: { flyby: "🐉", flybyPath: "sky", props: ["🏮", "🧧", "🏯", "🏮", "🍊", "🧨", "🏮", "🧧"], hills: ["#f7c1b3", "#e0705e", "#b03a2e"], click: "chime", scale: PENTA, tempo: 420 },
  valentines: { flyby: "💘", flybyPath: "sky", props: ["🌹", "💐", "🧸", "💝", "🌷", "🍫", "🌹", "💐"], hills: ["#fbd3e3", "#f39ab9", "#d9648e"], click: "chime", scale: PENTA, tempo: 520 },
  stpatricks: { flyby: "🌈", flybyPath: "sky", props: ["🍀", "🪙", "🎩", "☘️", "🍀", "🌈", "🪙", "☘️"], hills: ["#bfe8c4", "#6fcf86", "#2f9a4f"], click: "pop", scale: PENTA, tempo: 400 },
  spring: { flyby: "🦋", flybyPath: "sky", props: ["🌷", "🌼", "🐝", "🌸", "🐰", "🌷", "🌻", "🌼"], hills: ["#d6f2c9", "#9fdc85", "#5fb55a"], click: "chime", scale: PENTA, tempo: 460 },
  easter: { flyby: "🐰", flybyPath: "ground", props: ["🥚", "🐣", "🌷", "🧺", "🥕", "🐣", "🌼", "🥚"], hills: ["#e3f5d4", "#b7e3a0", "#86c46e"], click: "boing", scale: PENTA, tempo: 460 },
  earth: { flyby: "🐦", flybyPath: "sky", props: ["🌳", "🌻", "🐢", "🌲", "♻️", "🌳", "🦊", "🌲"], hills: ["#cdeccf", "#86cf8c", "#3f9b52"], click: "pop", scale: PENTA, tempo: 500 },
  summer: { flyby: "🏄", flybyPath: "ground", props: ["🌴", "🏖️", "⛱️", "🦀", "🌴", "🍉", "🐚", "⛱️"], hills: ["#fdf0c4", "#f8d77f", "#7dd3e3"], click: "splash", scale: PENTA, tempo: 420 },
  july4: { flyby: "🎆", flybyPath: "sky", props: ["🇺🇸", "🌭", "🍔", "🎇", "🦅", "🇺🇸", "🍉", "🎇"], hills: ["#d9e3fb", "#93b0ef", "#4c74d6"], click: "zap", scale: BELLS, tempo: 340 },
  school: { flyby: "🚌", flybyPath: "ground", props: ["🏫", "🎒", "📚", "✏️", "🍎", "🏫", "📐", "🎒"], hills: ["#f2ecc9", "#dcc77a", "#b19a3a"], click: "pop", scale: PENTA, tempo: 480 },
  space: { flyby: "🛸", flybyPath: "sky", props: ["🛰️", "👽", "🚀", "🌑", "👾", "🛰️", "🌑", "👽"], hills: ["#ddd6fe", "#a78bfa", "#6d4fd6"], click: "zap", scale: MINOR, tempo: 560 },
  ocean: { flyby: "🐋", flybyPath: "sky", props: ["🪸", "🐚", "🦀", "🐠", "🪸", "🐙", "🐚", "🦞"], hills: ["#c6eef3", "#6ccfdd", "#1f9ab3"], click: "splash", scale: PENTA, tempo: 600 },
  candy: { flyby: "🦄", flybyPath: "sky", props: ["🍭", "🧁", "🍩", "🍬", "🍭", "🍰", "🧁", "🍩"], hills: ["#fbd5ec", "#f39bd0", "#c77de0"], click: "pop", scale: PENTA, tempo: 380 },
  neon: { flyby: "🏎️", flybyPath: "ground", props: ["🌃", "🏙️", "🎧", "🌆", "🏙️", "🎧"], hills: ["#f2d4f7", "#d58ce6", "#8b3fd1"], click: "zap", scale: MINOR, tempo: 300 },
  retro: { flyby: "👾", flybyPath: "sky", props: ["🕹️", "👾", "📼", "💾", "🕹️", "👾"], hills: ["#e6ecd0", "#b7cc77", "#6b8f2a"], click: "zap", scale: PENTA, tempo: 260 },
};
