import { NextResponse, type NextRequest } from "next/server";
import { savePlayerPov } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { allow } from "@/lib/rateLimit";

/** POST { frames }: a player's device sends what their screen showed, once the game's replay is saved. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/replay/pov">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const token = req.headers.get("x-live-token");
  if (!allow(`pov:${token ?? "anon"}`, 4, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { frames?: unknown };
  try {
    await savePlayerPov(code, token, body.frames);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return liveError(e);
  }
}
