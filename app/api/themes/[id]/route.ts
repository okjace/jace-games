import { NextResponse, type NextRequest } from "next/server";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";
import { ThemeError, deleteTheme, saveTheme, uninstallTheme, viewTheme } from "@/lib/themesServer";

/** GET: a theme. PUT { data?, published?, removed? }: save it. DELETE: delete it (or ?uninstall=1 to take it out of ur themes). */
async function run(fn: () => Promise<unknown>): Promise<NextResponse> {
  try {
    return NextResponse.json((await fn()) ?? { ok: true });
  } catch (e) {
    if (e instanceof ThemeError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/themes/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  return run(async () => ({ theme: await viewTheme(id, await getSession()) }));
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/themes/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!allow(`themes-save:${session.user.id}`, 60, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
  return run(async () => ({ theme: await saveTheme(session, id, body) }));
}

export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/themes/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return run(() => (req.nextUrl.searchParams.get("uninstall") === "1" ? uninstallTheme(session, id) : deleteTheme(session, id)));
}
