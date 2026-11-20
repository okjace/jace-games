import { NextResponse, type NextRequest } from "next/server";
import { weeklyTop } from "@/lib/db/liveWeekly";
import { emailUser } from "@/lib/email";
import { featuredMode, lastWeek } from "@/lib/live/weekly";
import { MODES } from "@/lib/live/types";

/**
 * Mondays (vercel.json): emails everyone on last week's challenge board how
 * they did (only people who turned weekly results on get it). Vercel sends
 * CRON_SECRET as a bearer token.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  // Sends real emails, so it never runs without the secret on the live site.
  const secret = process.env.CRON_SECRET;
  if (!secret && process.env.NODE_ENV === "production") return NextResponse.json({ error: "CRON_SECRET isn't set" }, { status: 503 });
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const week = lastWeek();
  const def = MODES[featuredMode(week)];
  const rows = await weeklyTop(week, 50);
  rows.forEach((r, i) => {
    const place = i + 1;
    const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : "🏅";
    emailUser(r.user_id, "weekly", {
      subject: `Weekly challenge: u came #${place} in ${def.name}`,
      heading: `${medal} #${place} this week!`,
      message: [
        `Last week's challenge was ${def.icon} ${def.name}, n ur best was ${def.unit(r.best)}. That put u #${place} of ${rows.length} on the board.`,
        place <= 3 ? "U won prizes for ur locker! Open it to claim them before they're gone." : "Top 3 win locker prizes. A new challenge is up now, so go get it!",
      ].join("\n\n"),
      button: place <= 3 ? { label: "Claim ur prizes", url: "/live/locker" } : { label: "Play this week's challenge", url: "/live" },
    });
  });
  return NextResponse.json({ week, emailed: rows.length });
}
