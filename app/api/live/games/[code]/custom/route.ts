import { NextResponse, type NextRequest } from "next/server";
import { customGameHtml } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";

/** The Studio game a custom-mode Live game plays. Players only (X-Live-Token). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/custom">): Promise<NextResponse> {
  const { code } = await ctx.params;
  try {
    return NextResponse.json({ html: await customGameHtml(code, req.headers.get("x-live-token")) }, { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    return liveError(e);
  }
}
