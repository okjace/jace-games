import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ThemeError, installTheme } from "@/lib/themesServer";

/** POST: add a market theme to ur themes. */
export async function POST(_req: NextRequest, ctx: RouteContext<"/api/themes/[id]/install">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in w/ Jace to install themes." }, { status: 401 });
  try {
    return NextResponse.json({ theme: await installTheme(session, id) });
  } catch (e) {
    if (e instanceof ThemeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
