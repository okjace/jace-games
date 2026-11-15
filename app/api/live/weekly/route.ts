import { NextResponse } from "next/server";
import { weeklyTop } from "@/lib/db/liveWeekly";
import { featuredMode, lastWeek, weekEnds, weekOf } from "@/lib/live/weekly";
import { getSession } from "@/lib/session";

/** This week's challenge (mode, time left, top 50), last week's top 3, and whether I can claim a prize. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  const week = weekOf();
  const prev = lastWeek();
  const [top, prevTop] = await Promise.all([weeklyTop(week, 50).catch(() => []), weeklyTop(prev, 3).catch(() => [])]);
  const out = (r: { username: string; best: number; avatar: unknown; user_id: string }) => ({ name: r.username, best: r.best, avatar: r.avatar, you: !!session && r.user_id === session.user.id });
  const mine = session ? prevTop.findIndex((r) => r.user_id === session.user.id) : -1;
  return NextResponse.json(
    {
      week,
      mode: featuredMode(week),
      endsAt: weekEnds(week),
      top: top.map(out),
      last: { week: prev, mode: featuredMode(prev), top: prevTop.map(out) },
      prize: mine >= 0 && !prevTop[mine].claimed ? { place: mine + 1 } : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
