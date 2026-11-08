/**
 * The Live locker: the icon, frame and title people show in games. Everyone gets
 * the starter icons; more unlock as you level up by playing Live signed in
 * (XP is given when a game ends). Signed-in players can also use their Jace
 * profile picture. Shared by the server (which checks every choice) and the
 * browser.
 */

export type LockerItem = { id: string; name: string; level: number };
export type IconItem = LockerItem & { emoji: string };
export type FrameItem = LockerItem & { ring: string };
export type TitleItem = LockerItem & { color: string };

/** What a player shows: an icon (or "jace" for their Jace picture), a frame, and a title under their name. */
export type Avatar = { icon: string; frame: string; title?: string; picture?: string | null };

export const ICONS: IconItem[] = [
  { id: "smile", emoji: "😀", name: "Grin", level: 1 },
  { id: "cat", emoji: "🐱", name: "Cat", level: 1 },
  { id: "dog", emoji: "🐶", name: "Pup", level: 1 },
  { id: "frog", emoji: "🐸", name: "Frog", level: 1 },
  { id: "star", emoji: "⭐", name: "Star", level: 1 },
  { id: "pizza", emoji: "🍕", name: "Pizza", level: 1 },
  { id: "fox", emoji: "🦊", name: "Fox", level: 2 },
  { id: "panda", emoji: "🐼", name: "Panda", level: 2 },
  { id: "rocket", emoji: "🚀", name: "Rocket", level: 3 },
  { id: "ghost", emoji: "👻", name: "Ghost", level: 3 },
  { id: "octo", emoji: "🐙", name: "Octopus", level: 4 },
  { id: "cactus", emoji: "🌵", name: "Cactus", level: 4 },
  { id: "alien", emoji: "👽", name: "Visitor", level: 5 },
  { id: "robot", emoji: "🤖", name: "Robot", level: 5 },
  { id: "unicorn", emoji: "🦄", name: "Unicorn", level: 6 },
  { id: "ninja", emoji: "🥷", name: "Ninja", level: 7 },
  { id: "wizard", emoji: "🧙", name: "Wizard", level: 8 },
  { id: "shark", emoji: "🦈", name: "Shark", level: 9 },
  { id: "dragon", emoji: "🐲", name: "Dragon", level: 10 },
  { id: "crown", emoji: "👑", name: "Crown", level: 12 },
  { id: "phoenix", emoji: "🐦‍🔥", name: "Phoenix", level: 14 },
  { id: "galaxy", emoji: "🌌", name: "Galaxy", level: 16 },
  { id: "gem", emoji: "💎", name: "Gem", level: 18 },
  { id: "trophy", emoji: "🏆", name: "Champion", level: 20 },
  { id: "owl", emoji: "🦉", name: "Night Owl", level: 23 },
  { id: "volcano", emoji: "🌋", name: "Volcano", level: 26 },
  { id: "comet", emoji: "☄️", name: "Comet", level: 29 },
  { id: "tiger", emoji: "🐯", name: "Tiger", level: 32 },
  { id: "knight", emoji: "🛡️", name: "Knight", level: 35 },
  { id: "planet", emoji: "🪐", name: "Ringed Planet", level: 38 },
  { id: "lion", emoji: "🦁", name: "Lion", level: 42 },
  { id: "rainbow", emoji: "🌈", name: "Rainbow", level: 46 },
  { id: "eagle", emoji: "🦅", name: "Eagle", level: 50 },
  { id: "lightning", emoji: "⚡", name: "Lightning", level: 55 },
  { id: "mage", emoji: "🔮", name: "Crystal Ball", level: 60 },
  { id: "kraken", emoji: "🐙", name: "Deep One", level: 65 },
  { id: "sun", emoji: "🌞", name: "Sun", level: 70 },
  { id: "moon", emoji: "🌙", name: "Moon", level: 75 },
  { id: "fire", emoji: "🔥", name: "Inferno", level: 80 },
  { id: "infinity", emoji: "♾️", name: "Infinity", level: 85 },
  { id: "diamondcrown", emoji: "🫅", name: "Royalty", level: 90 },
  { id: "goat", emoji: "🐐", name: "Greatest", level: 95 },
  { id: "jstar", emoji: "🌟", name: "Superstar", level: 99 },
];

export const FRAMES: FrameItem[] = [
  { id: "none", name: "Plain", level: 1, ring: "transparent" },
  { id: "mint", name: "Mint", level: 1, ring: "#3ddc84" },
  { id: "sky", name: "Sky", level: 2, ring: "#38bdf8" },
  { id: "sunset", name: "Sunset", level: 4, ring: "linear-gradient(135deg,#f97316,#ec4899)" },
  { id: "ocean", name: "Ocean", level: 6, ring: "linear-gradient(135deg,#06b6d4,#3b82f6,#8b5cf6)" },
  { id: "gold", name: "Gold", level: 8, ring: "linear-gradient(135deg,#fde68a,#f59e0b,#b45309)" },
  { id: "lava", name: "Lava", level: 11, ring: "linear-gradient(135deg,#7f1d1d,#ef4444,#fbbf24)" },
  { id: "aurora", name: "Aurora", level: 15, ring: "linear-gradient(135deg,#22d3ee,#a78bfa,#34d399,#f472b6)" },
  { id: "legend", name: "Legend", level: 20, ring: "conic-gradient(#facc15,#f472b6,#38bdf8,#4ade80,#facc15)" },
  { id: "forest", name: "Forest", level: 25, ring: "linear-gradient(135deg,#14532d,#22c55e,#a3e635)" },
  { id: "candy", name: "Candy", level: 30, ring: "repeating-linear-gradient(45deg,#f472b6 0 6px,#fff 6px 12px)" },
  { id: "galaxy", name: "Galaxy", level: 40, ring: "radial-gradient(circle at 30% 30%,#a78bfa,#1e1b4b 70%)" },
  { id: "ice", name: "Ice", level: 50, ring: "linear-gradient(135deg,#e0f2fe,#7dd3fc,#0ea5e9)" },
  { id: "royal", name: "Royal", level: 60, ring: "linear-gradient(135deg,#4c1d95,#a855f7,#fde68a)" },
  { id: "neon", name: "Neon", level: 70, ring: "conic-gradient(#22d3ee,#a3e635,#f472b6,#22d3ee)" },
  { id: "sunburst", name: "Sunburst", level: 80, ring: "repeating-conic-gradient(#facc15 0 15deg,#f97316 15deg 30deg)" },
  { id: "obsidian", name: "Obsidian", level: 90, ring: "linear-gradient(135deg,#000,#4b5563,#000)" },
  { id: "mythic", name: "Mythic", level: 99, ring: "conic-gradient(#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#6366f1,#d946ef,#ef4444)" },
];

/** Titles: a word or two under your name in games. */
export const TITLES: TitleItem[] = [
  { id: "", name: "No title", level: 1, color: "" },
  { id: "rookie", name: "Rookie", level: 1, color: "#94a3b8" },
  { id: "learner", name: "Learner", level: 3, color: "#38bdf8" },
  { id: "quizzer", name: "Quizzer", level: 5, color: "#4ade80" },
  { id: "brainy", name: "Big Brain", level: 8, color: "#a78bfa" },
  { id: "whiz", name: "Quiz Whiz", level: 12, color: "#f472b6" },
  { id: "speedy", name: "Speedster", level: 16, color: "#facc15" },
  { id: "genius", name: "Genius", level: 22, color: "#fb923c" },
  { id: "scholar", name: "Scholar", level: 28, color: "#22d3ee" },
  { id: "mastermind", name: "Mastermind", level: 36, color: "#e879f9" },
  { id: "professor", name: "Professor", level: 45, color: "#fde047" },
  { id: "champion", name: "Champion", level: 55, color: "#fbbf24" },
  { id: "legend", name: "Legend", level: 70, color: "#f59e0b" },
  { id: "mythic", name: "Mythic", level: 85, color: "#d946ef" },
  { id: "grandmaster", name: "Grandmaster", level: 99, color: "#facc15" },
];

export const DEFAULT_AVATAR: Avatar = { icon: "smile", frame: "none" };

/** XP needed to go from `level` to the next one. */
export const xpForLevel = (level: number) => 100 + (level - 1) * 50;

export function levelInfo(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let left = Math.max(0, Math.floor(xp));
  while (left >= xpForLevel(level) && level < 99) {
    left -= xpForLevel(level);
    level++;
  }
  return { level, into: left, need: xpForLevel(level) };
}

export type XpPart = { label: string; xp: number };

/**
 * XP for finishing a game, as a list of what earned it: playing, right
 * answers, placing well, a win, answer streaks, a perfect game, and the
 * first game of the day. Capped so one game can't be farmed.
 */
export const XP_CAP = 400;
export function xpForGame(p: { correct: number; answered: number; rank: number; players: number; bestStreak: number; daily: boolean }): { total: number; parts: XpPart[] } {
  const parts: XpPart[] = [];
  const add = (label: string, xp: number) => xp > 0 && parts.push({ label, xp });
  if (p.answered === 0) add("Played a game", 10);
  else {
    add("Played a game", 20);
    add(`${p.correct} right answer${p.correct === 1 ? "" : "s"}`, Math.min(150, p.correct * 5));
  }
  if (p.players > 1) add(p.rank === 1 ? "1st place" : p.rank === 2 ? "2nd place" : p.rank === 3 ? "3rd place" : "", Math.max(0, 30 - (p.rank - 1) * 10));
  if (p.players >= 3 && p.rank === 1) add("Beat 2 or more players", 40);
  if (p.bestStreak >= 10) add(`🔥 ${p.bestStreak} in a row`, 50);
  else if (p.bestStreak >= 5) add(`🔥 ${p.bestStreak} in a row`, 25);
  if (p.answered >= 5 && p.correct === p.answered) add("💯 Perfect game", 60);
  if (p.daily) add("☀️ First game today", 50);
  let total = 0;
  for (const part of parts) total += part.xp;
  return { total: Math.min(XP_CAP, total), parts };
}

export const iconById = (id: string) => ICONS.find((i) => i.id === id);
export const frameById = (id: string) => FRAMES.find((f) => f.id === id);
export const titleById = (id: string | undefined) => TITLES.find((t) => t.id === (id ?? ""));

/**
 * A choice from a request, checked against what's unlocked. "jace" needs a
 * Jace picture. Anything not allowed falls back to the default.
 */
export function cleanAvatar(raw: unknown, level: number, picture: string | null): Avatar {
  const r = (raw ?? {}) as Record<string, unknown>;
  const icon =
    r.icon === "jace" && picture ? "jace" : typeof r.icon === "string" && (iconById(r.icon)?.level ?? 99) <= level ? r.icon : DEFAULT_AVATAR.icon;
  const frame = typeof r.frame === "string" && (frameById(r.frame)?.level ?? 99) <= level ? r.frame : DEFAULT_AVATAR.frame;
  const title = typeof r.title === "string" && r.title && (titleById(r.title)?.level ?? 999) <= level ? r.title : undefined;
  const base = title ? { icon, frame, title } : { icon, frame };
  return icon === "jace" ? { ...base, picture } : base;
}

/** Only https pictures are shown. */
export const safePicture = (url: string | null | undefined) => (url && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null);
