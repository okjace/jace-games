import { NextResponse, type NextRequest } from "next/server";
import { chatDelete, chatList, chatSend } from "@/lib/live/engine";
import { liveError } from "@/lib/live/http";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/**
 * Game chat. Players send their key in X-Live-Token; the host is recognized
 * by their sign-in. GET ?after=time: messages. POST { text }: send.
 * DELETE ?id=: the host deletes a message.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/chat">): Promise<NextResponse> {
  const { code } = await ctx.params;
  try {
    const session = req.headers.get("x-live-token") ? null : await getSession();
    return NextResponse.json(await chatList(code, req.headers.get("x-live-token"), session, req.nextUrl.searchParams.get("after") ?? undefined), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return liveError(e);
  }
}

export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/chat">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const token = req.headers.get("x-live-token");
  const session = token ? null : await getSession();
  if (!allow(`live-chat:${token ?? session?.user.id ?? "anon"}`, 15, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { text?: unknown };
  try {
    return NextResponse.json({ message: await chatSend(code, token, session, body.text) });
  } catch (e) {
    return liveError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/chat">): Promise<NextResponse> {
  const { code } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  try {
    await chatDelete(code, session, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return liveError(e);
  }
}
