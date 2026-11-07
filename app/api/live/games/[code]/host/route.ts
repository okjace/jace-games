import { NextResponse, type NextRequest } from "next/server";
import { hostAction, hostView } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { getSession } from "@/lib/session";

/** The host's screen: GET the full game; POST { action: start | next | reveal | tick | end | kick }. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/host">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    return NextResponse.json(await hostView(code, session), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return liveError(e);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/host">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.action !== "string") return NextResponse.json({ error: "Send { action }." }, { status: 400 });
  try {
    await hostAction(code, session, body);
    return NextResponse.json(await hostView(code, session));
  } catch (e) {
    return liveError(e);
  }
}
