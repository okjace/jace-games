import { NextResponse } from "next/server";
import { lockerStore } from "@/lib/db/liveLocker";
import { EMPTY_STATS, nextLoginStreak, streakXp } from "@/lib/live/locker";
import { getSession } from "@/lib/session";

const done = new Map<string, string>();

/**
 * The daily streak: the first visit each day (UTC, signed in) adds a day if
 * u were here yesterday (otherwise it starts over at 1) and gives XP for it.
 */
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ signedIn: false });
  const today = new Date().toISOString().slice(0, 10);
  // Two tabs at once only count once.
  if (done.get(session.user.id) === today) return NextResponse.json({ isNew: false });
  done.set(session.user.id, today);
  if (done.size > 10_000) done.clear();
  const store = lockerStore();
  const row = await store.get(session.user.id).catch(() => null);
  const stats = { ...EMPTY_STATS, ...(row?.stats ?? {}) };
  const next = nextLoginStreak(stats, today);
  if (!next.isNew) return NextResponse.json({ isNew: false, streak: next.streak, best: next.best });
  await store.addStats(session.user.id, (s) => ({ ...s, loginStreak: next.streak, loginBest: next.best, loginDay: today }));
  const xp = streakXp(next.streak);
  await store.addXp(session.user.id, xp).catch(() => {});
  return NextResponse.json({ isNew: true, streak: next.streak, best: next.best, xp });
}
