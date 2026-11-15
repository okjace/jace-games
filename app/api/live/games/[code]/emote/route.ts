import { NextResponse, type NextRequest } from "next/server";
import { sendEmote } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";

/** POST { emoji }: a player's emote, shown floating up on every screen. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/emote">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const body = ((await req.json().catch(() => null)) ?? {}) as { emoji?: unknown };
  try {
    await sendEmote(code, req.headers.get("x-live-token"), body.emoji);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return liveError(e);
  }
}
