import { NextResponse, type NextRequest } from "next/server";
import { saveGameReplay } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** POST { replay }: the host's screen (or a solo player's) saves the finished game's replay. → { id } */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/replay">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const token = req.headers.get("x-live-token");
  const session = await getSession();
  if (!allow(`replay:${session?.user.id ?? token ?? "anon"}`, 6, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { replay?: unknown };
  try {
    return NextResponse.json({ id: await saveGameReplay(code, session, token, body.replay) });
  } catch (e) {
    return liveError(e);
  }
}
