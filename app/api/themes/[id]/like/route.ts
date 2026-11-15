import { NextResponse, type NextRequest } from "next/server";
import { themeStore } from "@/lib/db/themes";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** POST { on: boolean }: like or unlike a market theme (signed in, one like each). → { likes, liked } */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/themes/[id]/like">): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in w/ Jace to like themes." }, { status: 401 });
  if (!allow(`theme-like:${session.user.id}`, 30, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const { id } = await ctx.params;
  const t = await themeStore.get(id);
  if (!t || !t.published || t.removed) return NextResponse.json({ error: "That theme isn't on the market." }, { status: 404 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { on?: unknown };
  const on = body.on !== false;
  return NextResponse.json({ likes: await themeStore.like(id, session.user.id, on), liked: on });
}
