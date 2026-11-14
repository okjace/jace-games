import { randomInt } from "crypto";
import { NextResponse } from "next/server";
import { lockerStore } from "@/lib/db/liveLocker";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/**
 * POST: opened a falling Christmas present. Small chance of a prize: XP, or
 * a free pick (unlock any one locker item without the level). The server
 * rolls the dice, presents can be opened once every few seconds, and
 * there's a cap on prizes per day.
 */
const CHANCE = 10; // percent
const MAX_WINS_PER_DAY = 5;

export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ won: false, signIn: true });
  if (!allow(`gift:${session.user.id}`, 1, 6_000)) return NextResponse.json({ won: false, tooFast: true });
  const store = lockerStore();
  const row = await store.get(session.user.id);
  const today = new Date().toISOString().slice(0, 10);
  const wins = row.stats?.giftDay === today ? (row.stats?.giftWins ?? 0) : 0;
  if (wins >= MAX_WINS_PER_DAY || randomInt(100) >= CHANCE) return NextResponse.json({ won: false });
  const xp = randomInt(100) < 65;
  const amount = xp ? randomInt(25, 151) : 0;
  if (xp) await store.addXp(session.user.id, amount);
  await store.addStats(session.user.id, (s) => ({ ...s, vouchers: (s.vouchers ?? 0) + (xp ? 0 : 1), giftDay: today, giftWins: wins + 1 }));
  return NextResponse.json({ won: true, prize: xp ? { kind: "xp", amount } : { kind: "pick" } });
}
