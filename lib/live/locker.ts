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

/** A frame someone designed (see CUSTOM_STYLES). frame: "custom" uses it. */
export type CustomFrame = { style: CustomStyle; colors: string[]; width: 1 | 2 | 3 };
export type CustomStyle = "solid" | "gradient" | "stripes" | "dots" | "swirl";

/**
 * What a player shows: an icon (or "jace" for their Jace picture), a frame
 * (or "custom" with their own design), a frame effect, a title, a name
 * color, a badge they earned, and a win celebration.
 */
export type Avatar = {
  icon: string;
  frame: string;
  custom?: CustomFrame;
  fx?: string;
  title?: string;
  nameColor?: string;
  badge?: string;
  effect?: string;
  picture?: string | null;
};

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

/** The custom frame maker unlocks at level 10; fancier styles later. */
export const CUSTOM_FRAME_LEVEL = 10;
export const CUSTOM_STYLES: { id: CustomStyle; name: string; level: number; colors: [number, number] }[] = [
  { id: "solid", name: "Solid", level: 10, colors: [1, 1] },
  { id: "gradient", name: "Gradient", level: 10, colors: [2, 4] },
  { id: "stripes", name: "Stripes", level: 15, colors: [2, 3] },
  { id: "dots", name: "Polka dots", level: 20, colors: [2, 2] },
  { id: "swirl", name: "Swirl", level: 25, colors: [2, 4] },
];

/** The CSS for a custom frame (only ever built from checked colors). */
export function customRing(c: CustomFrame): string {
  const [a, b = a, ...rest] = c.colors;
  const all = [a, b, ...rest];
  if (c.style === "solid") return a;
  if (c.style === "gradient") return `linear-gradient(135deg,${all.join(",")})`;
  if (c.style === "stripes") return `repeating-linear-gradient(45deg,${all.map((col, i) => `${col} ${i * 5}px ${(i + 1) * 5}px`).join(",")})`;
  if (c.style === "dots") return `radial-gradient(circle,${b} 28%,transparent 32%) 0 0/7px 7px,${a}`;
  return `conic-gradient(${[...all, a].join(",")})`;
}

/** Frame effects: how the frame moves. Work with any frame. */
export const FRAME_FX: (LockerItem & { className: string })[] = [
  { id: "", name: "Still", level: 1, className: "" },
  { id: "pulse", name: "Pulse", level: 12, className: "jg-fx-pulse" },
  { id: "glow", name: "Glow", level: 18, className: "jg-fx-glow" },
  { id: "spin", name: "Spin", level: 25, className: "jg-fx-spin" },
  { id: "bounce", name: "Bounce", level: 33, className: "jg-fx-bounce" },
  { id: "shimmer", name: "Shimmer", level: 44, className: "jg-fx-shimmer" },
  { id: "orbit", name: "Orbit", level: 60, className: "jg-fx-orbit" },
  { id: "hyper", name: "Hyperspin", level: 80, className: "jg-fx-hyper" },
];

/** Name colors: how your name looks in games. */
export const NAME_COLORS: (LockerItem & { css: string })[] = [
  { id: "", name: "Default", level: 1, css: "" },
  { id: "mint", name: "Mint", level: 4, css: "#3ddc84" },
  { id: "sky", name: "Sky", level: 6, css: "#38bdf8" },
  { id: "rose", name: "Rose", level: 9, css: "#fb7185" },
  { id: "gold", name: "Gold", level: 14, css: "#facc15" },
  { id: "violet", name: "Violet", level: 19, css: "#a78bfa" },
  { id: "sunset", name: "Sunset", level: 24, css: "linear-gradient(90deg,#f97316,#ec4899)" },
  { id: "ocean", name: "Ocean", level: 30, css: "linear-gradient(90deg,#06b6d4,#6366f1)" },
  { id: "toxic", name: "Toxic", level: 37, css: "linear-gradient(90deg,#a3e635,#22c55e)" },
  { id: "fire", name: "Fire", level: 48, css: "linear-gradient(90deg,#ef4444,#f59e0b,#fde047)" },
  { id: "ice", name: "Ice", level: 58, css: "linear-gradient(90deg,#e0f2fe,#7dd3fc,#a5b4fc)" },
  { id: "galaxy", name: "Galaxy", level: 72, css: "linear-gradient(90deg,#c084fc,#6366f1,#22d3ee)" },
  { id: "rainbow", name: "Rainbow", level: 88, css: "linear-gradient(90deg,#ef4444,#f59e0b,#eab308,#22c55e,#06b6d4,#6366f1,#d946ef)" },
];

/** Win celebrations: what rains down when you win (or finish solo). */
export const EFFECTS: (LockerItem & { emojis: string[] })[] = [
  { id: "", name: "None", level: 1, emojis: [] },
  { id: "confetti", name: "Confetti", level: 5, emojis: ["🎉", "🎊"] },
  { id: "stars", name: "Stars", level: 11, emojis: ["⭐", "🌟", "✨"] },
  { id: "hearts", name: "Hearts", level: 16, emojis: ["💖", "💜", "💙"] },
  { id: "snow", name: "Snowfall", level: 22, emojis: ["❄️", "☃️"] },
  { id: "fireworks", name: "Fireworks", level: 29, emojis: ["🎆", "🎇", "💥"] },
  { id: "money", name: "Money Rain", level: 38, emojis: ["💸", "💰", "🪙"] },
  { id: "food", name: "Snack Attack", level: 47, emojis: ["🍕", "🍩", "🍔", "🍦"] },
  { id: "storm", name: "Thunderstorm", level: 56, emojis: ["⚡", "🌩️", "💧"] },
  { id: "space", name: "Space Trip", level: 68, emojis: ["🚀", "🪐", "🌠", "👽"] },
  { id: "dragons", name: "Dragon Flight", level: 82, emojis: ["🐉", "🔥", "🐲"] },
  { id: "legend", name: "Legendary", level: 99, emojis: ["👑", "💎", "🏆", "🌟"] },
];

/** What a player has done in Live (signed in), for badges. */
export type LiveStats = { games: number; wins: number; perfect: number; right: number; bestStreak: number };
export const EMPTY_STATS: LiveStats = { games: 0, wins: 0, perfect: 0, right: 0, bestStreak: 0 };

/** Badges: earned by doing things (not by level). Show one next to your name. */
export const BADGES: { id: string; emoji: string; name: string; how: string; earned: (s: LiveStats, level: number) => boolean; progress?: (s: LiveStats) => [number, number] }[] = [
  { id: "first", emoji: "🎮", name: "First Game", how: "Finish a game", earned: (s) => s.games >= 1 },
  { id: "regular", emoji: "📅", name: "Regular", how: "Finish 10 games", earned: (s) => s.games >= 10, progress: (s) => [s.games, 10] },
  { id: "veteran", emoji: "🎖️", name: "Veteran", how: "Finish 50 games", earned: (s) => s.games >= 50, progress: (s) => [s.games, 50] },
  { id: "centurion", emoji: "💯", name: "Centurion", how: "Finish 100 games", earned: (s) => s.games >= 100, progress: (s) => [s.games, 100] },
  { id: "winner", emoji: "🥇", name: "Winner", how: "Win a game against someone", earned: (s) => s.wins >= 1 },
  { id: "champ", emoji: "🏆", name: "Champ", how: "Win 10 games", earned: (s) => s.wins >= 10, progress: (s) => [s.wins, 10] },
  { id: "dynasty", emoji: "👑", name: "Dynasty", how: "Win 50 games", earned: (s) => s.wins >= 50, progress: (s) => [s.wins, 50] },
  { id: "perfect", emoji: "✅", name: "Flawless", how: "Get a perfect game (5+ answers)", earned: (s) => s.perfect >= 1 },
  { id: "perfectionist", emoji: "💎", name: "Perfectionist", how: "Get 10 perfect games", earned: (s) => s.perfect >= 10, progress: (s) => [s.perfect, 10] },
  { id: "streak10", emoji: "🔥", name: "On Fire", how: "Get 10 right in a row", earned: (s) => s.bestStreak >= 10, progress: (s) => [s.bestStreak, 10] },
  { id: "streak25", emoji: "☄️", name: "Unstoppable", how: "Get 25 right in a row", earned: (s) => s.bestStreak >= 25, progress: (s) => [s.bestStreak, 25] },
  { id: "right100", emoji: "🧠", name: "Brainiac", how: "Answer 100 questions right", earned: (s) => s.right >= 100, progress: (s) => [s.right, 100] },
  { id: "right1000", emoji: "🎓", name: "Encyclopedia", how: "Answer 1,000 questions right", earned: (s) => s.right >= 1000, progress: (s) => [s.right, 1000] },
  { id: "lvl25", emoji: "🥉", name: "Bronze Star", how: "Reach level 25", earned: (_, l) => l >= 25 },
  { id: "lvl50", emoji: "🥈", name: "Silver Star", how: "Reach level 50", earned: (_, l) => l >= 50 },
  { id: "lvl99", emoji: "🌟", name: "Max Level", how: "Reach level 99", earned: (_, l) => l >= 99 },
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
export const fxById = (id: string | undefined) => FRAME_FX.find((f) => f.id === (id ?? ""));
export const nameColorById = (id: string | undefined) => NAME_COLORS.find((c) => c.id === (id ?? ""));
export const effectById = (id: string | undefined) => EFFECTS.find((e) => e.id === (id ?? ""));
export const badgeById = (id: string | undefined) => BADGES.find((b) => b.id === id);

/** A custom frame from a request, or null if it isn't valid or isn't unlocked. */
export function cleanCustomFrame(raw: unknown, level: number): CustomFrame | null {
  if (level < CUSTOM_FRAME_LEVEL || !raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const style = CUSTOM_STYLES.find((st) => st.id === r.style);
  if (!style || style.level > level) return null;
  const colors = (Array.isArray(r.colors) ? r.colors : []).filter((c): c is string => typeof c === "string" && /^#[0-9a-fA-F]{6}$/.test(c)).map((c) => c.toLowerCase());
  if (colors.length < style.colors[0]) return null;
  const width = r.width === 1 || r.width === 3 ? r.width : 2;
  return { style: style.id, colors: colors.slice(0, style.colors[1]), width };
}

/**
 * A choice from a request, checked against what's unlocked. "jace" needs a
 * Jace picture. Anything not allowed falls back to the default.
 */
export function cleanAvatar(raw: unknown, level: number, picture: string | null, stats: LiveStats = EMPTY_STATS): Avatar {
  const r = (raw ?? {}) as Record<string, unknown>;
  const unlocked = <T extends LockerItem>(find: (id: string) => T | undefined, v: unknown) =>
    typeof v === "string" && v && (find(v)?.level ?? 999) <= level ? v : undefined;
  const icon =
    r.icon === "jace" && picture ? "jace" : typeof r.icon === "string" && (iconById(r.icon)?.level ?? 999) <= level ? r.icon : DEFAULT_AVATAR.icon;
  // Unknown ids count as never unlocked; "custom" needs a valid design.
  const custom = r.frame === "custom" ? cleanCustomFrame(r.custom, level) : null;
  const frame = custom ? "custom" : typeof r.frame === "string" && (frameById(r.frame)?.level ?? 999) <= level ? r.frame : DEFAULT_AVATAR.frame;
  const badge = typeof r.badge === "string" && badgeById(r.badge)?.earned(stats, level) ? r.badge : undefined;
  const out: Avatar = { icon, frame };
  if (custom) out.custom = custom;
  const fx = unlocked(fxById, r.fx);
  const title = unlocked(titleById, r.title);
  const nameColor = unlocked(nameColorById, r.nameColor);
  const effect = unlocked(effectById, r.effect);
  if (fx) out.fx = fx;
  if (title) out.title = title;
  if (nameColor) out.nameColor = nameColor;
  if (effect) out.effect = effect;
  if (badge) out.badge = badge;
  if (icon === "jace") out.picture = picture;
  return out;
}

/** Folds one finished game into someone's stats. */
export function addGameToStats(s: LiveStats, g: { won: boolean; perfect: boolean; right: number; bestStreak: number }): LiveStats {
  return {
    games: s.games + 1,
    wins: s.wins + (g.won ? 1 : 0),
    perfect: s.perfect + (g.perfect ? 1 : 0),
    right: s.right + g.right,
    bestStreak: Math.max(s.bestStreak, g.bestStreak),
  };
}

/** Only https pictures are shown. */
export const safePicture = (url: string | null | undefined) => (url && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null);
