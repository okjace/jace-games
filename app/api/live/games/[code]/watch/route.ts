import { NextResponse, type NextRequest } from "next/server";
import { spectatorView } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { allow } from "@/lib/rateLimit";

/** GET: the game for a spectator (scores, teams, the question on screen; never chat or answers early). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/watch">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anon";
  if (!allow(`watch:${ip}`, 60, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  try {
    return NextResponse.json(await spectatorView(code), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}
