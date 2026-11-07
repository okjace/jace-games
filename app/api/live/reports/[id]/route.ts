import { NextResponse, type NextRequest } from "next/server";
import { reportStore } from "@/lib/db/liveReports";
import { getSession } from "@/lib/session";

/** GET: one of my saved reports. DELETE: delete it. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/live/reports/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const row = session && /^[0-9a-f-]{36}$/.test(id) ? await reportStore().get(id) : null;
  if (!session || !row || row.host_id !== session.user.id) return NextResponse.json({ error: "That report doesn't exist." }, { status: 404 });
  return NextResponse.json({ report: row.data, savedAt: row.created_at, expiresAt: row.expires_at }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/live/reports/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const row = session && /^[0-9a-f-]{36}$/.test(id) ? await reportStore().get(id) : null;
  if (!session || !row || row.host_id !== session.user.id) return NextResponse.json({ error: "That report doesn't exist." }, { status: 404 });
  await reportStore().remove(id);
  return NextResponse.json({ ok: true });
}
