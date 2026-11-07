import { NextResponse, type NextRequest } from "next/server";
import { joinLiveGame } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** Join with a nickname (no account needed): { name } → { token, playerId }. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/join">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!allow(`live-join:${ip}`, 20, 60_000)) return NextResponse.json({ error: "Too many tries. Wait a minute." }, { status: 429 });
  const body = (await req.json().catch(() => null)) as { name?: unknown; avatar?: unknown } | null;
  try {
    return NextResponse.json(await joinLiveGame(code, body?.name, await getSession(), body?.avatar));
  } catch (e) {
    return liveError(e);
  }
}
