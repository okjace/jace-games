import { NextResponse } from "next/server";
import { lockerStore } from "@/lib/db/liveLocker";
import { markClaimed, weeklyTop } from "@/lib/db/liveWeekly";
import { grantName } from "@/lib/live/locker";
import { lastWeek, weeklyPrizes } from "@/lib/live/weekly";
import { getSession } from "@/lib/session";

/** Last week's top 3 claim their prize (exclusive locker items), once. */
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const week = lastWeek();
  const top = await weeklyTop(week, 3);
  const place = top.findIndex((r) => r.user_id === session.user.id) + 1;
  if (!place) return NextResponse.json({ error: "U weren't in last week's top 3." }, { status: 403 });
  if (!(await markClaimed(week, session.user.id))) return NextResponse.json({ error: "U already got this prize." }, { status: 409 });
  const prizes = weeklyPrizes(place);
  const locker = await lockerStore().get(session.user.id);
  await lockerStore().setGranted(session.user.id, [...new Set([...(locker.granted_badges ?? []), ...prizes])]);
  return NextResponse.json({ place, items: prizes.map(grantName) });
}
