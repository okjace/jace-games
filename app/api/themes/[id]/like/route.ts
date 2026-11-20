import { NextResponse, type NextRequest } from "next/server";
import { themeStore } from "@/lib/db/themes";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";
import { emailUser, milestone } from "@/lib/email";

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
  const likes = await themeStore.like(id, session.user.id, on);
  // Round numbers of likes (1st, 10th, 25th…): a little "nice!!" email for the maker.
  if (on && likes > (t.likes ?? 0) && milestone(likes) && t.owner_id !== session.user.id && allow(`like-email:${id}:${likes}`, 1, 30 * 86_400_000)) {
    emailUser(t.owner_id, "community", {
      subject: likes === 1 ? `Someone liked ur theme ${t.name}!` : `Ur theme ${t.name} hit ${likes} likes!`,
      heading: likes === 1 ? "💖 ur first like!" : `💖 ${likes} likes!`,
      message: likes === 1 ? `Someone on the theme market liked ${t.icon} ${t.name}. Nice work!` : `${t.icon} ${t.name} now has ${likes} likes on the theme market. Ppl love it!`,
      button: { label: "See it on the market", url: `/themes` },
    });
  }
  return NextResponse.json({ likes, liked: on });
}
