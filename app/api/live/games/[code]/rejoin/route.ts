import { NextResponse, type NextRequest } from "next/server";
import { rejoinMine } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** One-tap rejoin for a signed-in player: → { token } for their spot in this game. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/rejoin">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to rejoin." }, { status: 401 });
  if (!allow(`live-rejoin:${session.user.id}`, 20, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  try {
    return NextResponse.json(await rejoinMine(code, session));
  } catch (e) {
    return liveError(e);
  }
}
