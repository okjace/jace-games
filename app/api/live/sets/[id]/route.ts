import { NextResponse, type NextRequest } from "next/server";
import { liveStore } from "@/lib/db/live";
import { liveError } from "@/lib/live/http";
import { canSee, publicSet, saveSet } from "@/lib/live/sets";
import { getSession } from "@/lib/session";
import { isSiteOwner } from "@/lib/studio/server";

/** GET a set (answers only for its owner). PUT: save (owner). DELETE: delete (owner). PATCH {removed}: site owner. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/live/sets/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const set = /^[0-9a-f-]{36}$/.test(id) ? await liveStore().getSet(id) : null;
  if (!set || !canSee(set, session?.user.id ?? null)) return NextResponse.json({ error: "That set doesn't exist." }, { status: 404 });
  return NextResponse.json({ set: publicSet(set, session?.user.id ?? null), mine: set.owner_id === session?.user.id });
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/live/sets/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  try {
    const body = ((await req.json().catch(() => null)) ?? {}) as Record<string, unknown>;
    return NextResponse.json({ set: await saveSet(session, id, body) });
  } catch (e) {
    return liveError(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/live/sets/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const set = session ? await liveStore().getSet(id) : null;
  if (!session || !set || set.owner_id !== session.user.id) return NextResponse.json({ error: "That set isn't yours." }, { status: 403 });
  await liveStore().deleteSet(id);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/live/sets/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!isSiteOwner(session?.user.id)) return NextResponse.json({ error: "Only the site owner can do that." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { removed?: unknown } | null;
  const set = await liveStore().updateSet(id, { removed: !!body?.removed });
  return set ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found." }, { status: 404 });
}
