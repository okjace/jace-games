/**
 * The Live locker: the icon and frame people show in games. Everyone gets
 * the starter icons; more unlock as you level up by playing Live signed in
 * (XP is given when a game ends). Signed-in players can also use their Jace
 * profile picture. Shared by the server (which checks every choice) and the
 * browser.
 */

export type LockerItem = { id: string; name: string; level: number };
export type IconItem = LockerItem & { emoji: string };
export type FrameItem = LockerItem & { ring: string };

/** What a player shows: an icon (or "jace" for their Jace picture) and a frame. */
export type Avatar = { icon: string; frame: string; picture?: string | null };

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

/** XP for finishing a game: a bit for playing, more for right answers and for placing well. */
export function xpForGame(p: { correct: number; answered: number; rank: number; players: number }): number {
  if (p.answered === 0 && p.correct === 0) return 10;
  const place = p.players > 1 ? Math.max(0, 30 - (p.rank - 1) * 10) : 0;
  return Math.min(150, 20 + p.correct * 5 + place);
}

export const iconById = (id: string) => ICONS.find((i) => i.id === id);
export const frameById = (id: string) => FRAMES.find((f) => f.id === id);

/**
 * A choice from a request, checked against what's unlocked. "jace" needs a
 * Jace picture. Anything not allowed falls back to the default.
 */
export function cleanAvatar(raw: unknown, level: number, picture: string | null): Avatar {
  const r = (raw ?? {}) as Record<string, unknown>;
  const icon =
    r.icon === "jace" && picture ? "jace" : typeof r.icon === "string" && (iconById(r.icon)?.level ?? 99) <= level ? r.icon : DEFAULT_AVATAR.icon;
  const frame = typeof r.frame === "string" && (frameById(r.frame)?.level ?? 99) <= level ? r.frame : DEFAULT_AVATAR.frame;
  return icon === "jace" ? { icon, frame, picture } : { icon, frame };
}

/** Only https pictures are shown. */
export const safePicture = (url: string | null | undefined) => (url && /^https:\/\/[^\s"'<>]+$/.test(url) ? url : null);
