import { NextResponse, type NextRequest } from "next/server";
import { playerAction, playerView } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { allow } from "@/lib/rateLimit";

/**
 * A player's screen. The player's secret token (from joining) goes in the
 * X-Live-Token header. GET: my view. POST { action: answer | next | pick | tap }.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/play">): Promise<NextResponse> {
  const { code } = await ctx.params;
  try {
    return NextResponse.json(await playerView(code, req.headers.get("x-live-token")), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/play">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const token = req.headers.get("x-live-token");
  if (!allow(`live-play:${token}`, 12, 5_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Send { action }." }, { status: 400 });
  try {
    return NextResponse.json(await playerAction(code, token, body));
  } catch (e) {
    return liveError(e);
  }
}
