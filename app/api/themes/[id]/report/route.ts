import { NextResponse, type NextRequest } from "next/server";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";
import { ThemeError, reportTheme } from "@/lib/themesServer";

/** POST { reason }: report a market theme to the site owner. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/themes/[id]/report">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in to report themes." }, { status: 401 });
  if (!allow(`themes-report:${session.user.id}`, 10, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { reason?: unknown };
  try {
    const fresh = await reportTheme(session, id, body.reason);
    return NextResponse.json({ ok: true, already: !fresh });
  } catch (e) {
    if (e instanceof ThemeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
