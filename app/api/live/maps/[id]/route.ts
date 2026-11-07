import { NextResponse, type NextRequest } from "next/server";
import { mapStore } from "@/lib/db/liveMaps";
import { getUserInfo } from "@/lib/jace";
import { cleanMap } from "@/lib/live/maps";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** GET a map (public, or your own). PUT: save (owner). DELETE: delete (owner). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/live/maps/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const map = /^[0-9a-f-]{36}$/.test(id) ? await mapStore().get(id) : null;
  const mine = !!map && map.owner_id === session?.user.id;
  if (!map || (!mine && (map.visibility !== "public" || map.removed))) return NextResponse.json({ error: "That map doesn't exist." }, { status: 404 });
  return NextResponse.json({ map, mine });
}

export async function PUT(req: NextRequest, ctx: RouteContext<"/api/live/maps/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const map = session ? await mapStore().get(id) : null;
  if (!session || !map || map.owner_id !== session.user.id) return NextResponse.json({ error: "That map isn't yours." }, { status: 403 });
  if (!allow(`live-map-save:${session.user.id}`, 60, 60_000)) return NextResponse.json({ error: "Saving too often." }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { title?: unknown; data?: unknown; visibility?: unknown };
  const cleaned = cleanMap(body.data ?? map.data);
  if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });
  const visibility = body.visibility === "public" ? "public" : body.visibility === "private" ? "private" : map.visibility;
  if (visibility === "public" && map.visibility !== "public") {
    const info = await getUserInfo(session.token).catch(() => null);
    if (info?.banned || info?.muted) return NextResponse.json({ error: "This Jace account can't publish maps." }, { status: 403 });
  }
  const saved = await mapStore().update(id, {
    title: typeof body.title === "string" ? body.title.trim().slice(0, 60) || map.title : map.title,
    data: cleaned.map,
    visibility,
  });
  return NextResponse.json({ map: saved });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/live/maps/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const map = session ? await mapStore().get(id) : null;
  if (!session || !map || map.owner_id !== session.user.id) return NextResponse.json({ error: "That map isn't yours." }, { status: 403 });
  await mapStore().remove(id);
  return NextResponse.json({ ok: true });
}
