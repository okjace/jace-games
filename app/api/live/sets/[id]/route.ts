import { NextResponse, type NextRequest } from "next/server";
import { liveStore } from "@/lib/db/live";
import { liveError } from "@/lib/live/http";
import { canSee, publicSet, saveSet } from "@/lib/live/sets";
import { getSession } from "@/lib/session";
import { emailUser } from "@/lib/email";
import { isSiteOwner } from "@/lib/studio/server";
import { isRareSet } from "@/lib/live/rare";

/** GET a set (answers only for its owner). PUT: save (owner). DELETE: delete (owner). PATCH {removed?, verified?}: site owner. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/live/sets/[id]">): Promise<NextResponse> {
  const { id } = await ctx.params;
  const session = await getSession();
  const set = /^[0-9a-f-]{36}$/.test(id) ? await liveStore().getSet(id) : null;
  if (!set || !canSee(set, session?.user.id ?? null)) return NextResponse.json({ error: "That set doesn't exist." }, { status: 404 });
  return NextResponse.json({
    set: publicSet(set, session?.user.id ?? null),
    mine: set.owner_id === session?.user.id,
    siteOwner: isSiteOwner(session?.user.id),
    rare: isRareSet(set.questions),
  });
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
  const body = ((await req.json().catch(() => null)) ?? {}) as { removed?: unknown; verified?: unknown };
  const patch: { removed?: boolean; verified?: boolean } = {};
  if (typeof body.removed === "boolean") patch.removed = body.removed;
  if (typeof body.verified === "boolean") patch.verified = body.verified;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Send removed or verified." }, { status: 400 });
  const before = await liveStore().getSet(id);
  const set = await liveStore().updateSet(id, patch);
  if (!set) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (before && patch.removed !== undefined && patch.removed !== !!before.removed) {
    emailUser(set.owner_id, "moderation", {
      subject: patch.removed ? `Ur set ${set.title} was taken down` : `Ur set ${set.title} is back up`,
      heading: patch.removed ? "🛡️ set taken down" : "✅ set is back",
      message: patch.removed
        ? `A moderator took ur question set ${set.title} down, usually because it broke the rules after someone reported it. U can still open n edit it.\n\nIf u think it was a mistake, fix what might be wrong n reach out to the Jace Live team.`
        : `Good news: ur question set ${set.title} is back up for evryone.`,
      button: { label: "Open ur set", url: `/live/sets/${id}` },
    });
  }
  if (before && patch.verified && !before.verified) {
    emailUser(set.owner_id, "moderation", {
      subject: `Ur set ${set.title} got verified!`,
      heading: "✅ verified!",
      message: `The Jace Live team checked ur question set ${set.title} n gave it a ✓ Verified badge. Great work!`,
      button: { label: "See ur set", url: `/live/sets/${id}` },
    });
  }
  return NextResponse.json({ ok: true });
}
