import { NextResponse, type NextRequest } from "next/server";
import { liveStore } from "@/lib/db/live";
import { setReportStore } from "@/lib/db/liveSetReports";
import { canSee } from "@/lib/live/sets";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/** Report a set to the site owner: { reason }. Signed in, one report per person per set. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/sets/[id]/report">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to report a set." }, { status: 401 });
  if (!allow(`live-set-report:${session.user.id}`, 10, 3_600_000)) return NextResponse.json({ error: "You've sent a lot of reports. Try again later." }, { status: 429 });
  const set = /^[0-9a-f-]{36}$/.test(id) ? await liveStore().getSet(id) : null;
  if (!set || !canSee(set, session.user.id)) return NextResponse.json({ error: "That set doesn't exist." }, { status: 404 });
  if (set.owner_id === session.user.id) return NextResponse.json({ error: "You can't report your own set." }, { status: 400 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { reason?: unknown };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (reason.length < 3) return NextResponse.json({ error: "Say what's wrong with it." }, { status: 400 });
  const added = await setReportStore().add({ set_id: id, reporter_id: session.user.id, reporter_name: session.user.username, reason });
  return NextResponse.json({ ok: true, already: !added });
}
