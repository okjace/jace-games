import "server-only";
import { grantedOf, lockerStore, lookOf, statsOf } from "@/lib/db/liveLocker";
import { bestsFor } from "@/lib/db/liveBoards";
import { liveStore } from "@/lib/db/live";
import { themeStore } from "@/lib/db/themes";
import { publicProfileByName, publicProfiles } from "@/lib/db/userPrefs";
import { BADGES, cleanAvatar, hasBadge, levelInfo } from "@/lib/live/locker";
import { MODES, type LiveMode } from "@/lib/live/types";
import { summary } from "@/lib/themesServer";

/** Public profiles: only people who turned theirs on show up anywhere. */

async function card(user_id: string, prefs: { username?: string; displayName?: string; bio?: string }) {
  const row = await lockerStore().get(user_id);
  const level = levelInfo(row.xp).level;
  return {
    username: prefs.username ?? "",
    displayName: prefs.displayName ?? prefs.username ?? "",
    bio: prefs.bio ?? "",
    level,
    avatar: cleanAvatar(lookOf(row), level, null, statsOf(row), grantedOf(row)),
  };
}

export async function findPeople(q: string) {
  const rows = await publicProfiles(q, 60);
  return Promise.all(rows.map((r) => card(r.user_id, r.prefs)));
}

export async function profileOf(username: string) {
  const hit = await publicProfileByName(username);
  if (!hit) return null;
  const base = await card(hit.user_id, hit.prefs);
  const row = await lockerStore().get(hit.user_id);
  const stats = statsOf(row);
  const [sets, themes, bests] = await Promise.all([liveStore().mySets(hit.user_id), themeStore.byOwner(hit.user_id), bestsFor(hit.user_id)]);
  return {
    ...base,
    xp: row.xp,
    stats: { games: stats.games, wins: stats.wins, right: stats.right, bestStreak: stats.bestStreak },
    badges: BADGES.filter((b) => hasBadge(b.id, stats, base.level, grantedOf(row))).map((b) => ({ id: b.id, emoji: b.emoji, name: b.name })),
    sets: sets.filter((s) => s.visibility === "public" && !s.removed).slice(0, 12),
    themes: themes.filter((t) => t.published && !t.removed).map(summary).slice(0, 12),
    bests: bests.filter((b) => b.mode in MODES).map((b) => ({ mode: b.mode as LiveMode, best: b.best })),
  };
}
