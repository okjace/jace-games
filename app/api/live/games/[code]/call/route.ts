import { NextResponse, type NextRequest } from "next/server";
import { liveStore } from "@/lib/db/live";
import { CallError, callJoin, callLeave, callSignal, callState } from "@/lib/live/calls";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/**
 * In-game voice calls (only between Jace Social friends, only after pressing join).
 * GET ?beat=1: my call and the friends in it (and keeps me in it).
 * POST { action: "join", room: "game" | "team" } | { action: "leave" } | { action: "signal", to, kind, sdp }.
 */
async function game(code: string) {
  if (!/^\d{6}$/.test(code)) throw new CallError("No game with that code.", 404);
  const g = await liveStore().gameByCode(code);
  if (!g) throw new CallError("No game with that code.", 404);
  return g;
}
const fail = (e: unknown) => {
  if (e instanceof CallError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Calls aren't working right now." }, { status: 500 });
};

export async function GET(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/call">): Promise<NextResponse> {
  const { code } = await ctx.params;
  try {
    return NextResponse.json(await callState(await game(code), await getSession(), req.nextUrl.searchParams.get("beat") === "1"), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/call">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const session = await getSession();
  if (!allow(`call:${session?.user.id ?? "anon"}`, 90, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { action?: unknown; room?: unknown };
  try {
    const g = await game(code);
    if (body.action === "join") return NextResponse.json(await callJoin(g, session, body.room));
    if (body.action === "leave") {
      await callLeave(g, session);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "signal") {
      await callSignal(g, session, body);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    return fail(e);
  }
}
