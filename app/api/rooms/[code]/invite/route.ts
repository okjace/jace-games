import { NextResponse, type NextRequest } from "next/server";
import { roomStore } from "@/lib/db/rooms";
import { SocialError, socialInvite } from "@/lib/jaceSocial";
import { appOrigin } from "@/lib/routes";
import { getSession } from "@/lib/session";

const MESSAGES: Record<string, string> = {
  not_friends: "You can only invite your Jace Social friends.",
  rate_limited: "That's a lot of invites. Wait a minute and try again.",
  not_linked: "Open Jace Social once with your Jace account to invite friends.",
  account_banned: "This account can't send invites.",
};

/** { to: <Jace Social uuid> } → sends that friend a DM with this room's link. Room members only. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/rooms/[code]/invite">): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { to?: unknown } | null;
  if (typeof body?.to !== "string" || !/^[0-9a-f-]{32,36}$/i.test(body.to)) {
    return NextResponse.json({ error: "Pick a friend." }, { status: 400 });
  }
  const store = roomStore();
  const room = await store.roomByCode(code.toUpperCase());
  if (!room || room.status === "done") return NextResponse.json({ error: "That room isn't open." }, { status: 404 });
  const players = await store.players(room.id);
  if (!players.some((p) => p.user_id === session.user.id && !p.left_at)) {
    return NextResponse.json({ error: "You're not in this room." }, { status: 403 });
  }
  try {
    await socialInvite(session.token, {
      to: body.to,
      game: String(room.settings.name ?? room.game).slice(0, 60),
      url: `${appOrigin(req)}/r/${room.code}`,
      code: room.code,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = e instanceof SocialError ? e.code : "server_error";
    if (!(e instanceof SocialError)) console.error(e);
    return NextResponse.json({ error: MESSAGES[code] ?? "Couldn't send the invite." }, { status: e instanceof SocialError ? e.status : 500 });
  }
}
