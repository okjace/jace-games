import { NextResponse, type NextRequest } from "next/server";
import { liveStore } from "@/lib/db/live";
import { SocialError, socialInvite } from "@/lib/jaceSocial";
import { MODES } from "@/lib/live/types";
import { appOrigin } from "@/lib/routes";
import { getSession } from "@/lib/session";

const MESSAGES: Record<string, string> = {
  not_friends: "U can only invite ur Jace Social friends.",
  rate_limited: "Thats a lot of invites. Wait a minute n try again.",
  not_linked: "Open Jace Social once with ur Jace account to invite friends.",
  account_banned: "This account can't send invites.",
};

/** { to: <Jace Social uuid> } → sends that friend a Jace Social DM with this game's join link. The host or a signed-in player in it. */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/live/games/[code]/invite">): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { code } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { to?: unknown } | null;
  if (typeof body?.to !== "string" || !/^[0-9a-f-]{32,36}$/i.test(body.to)) return NextResponse.json({ error: "Pick a friend." }, { status: 400 });
  if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: "That game isn't open." }, { status: 404 });
  const store = liveStore();
  const g = await store.gameByCode(code);
  if (!g || g.status === "ended" || (g.settings as { solo?: boolean }).solo) return NextResponse.json({ error: "That game isn't open." }, { status: 404 });
  const inIt = g.host_id === session.user.id || (await store.players(g.id)).some((p) => p.user_id === session.user.id);
  if (!inIt) return NextResponse.json({ error: "Ur not in this game." }, { status: 403 });
  try {
    await socialInvite(session.token, { to: body.to, game: `Jace Live: ${MODES[g.mode].name}`, url: `${appOrigin(req)}/live/play/${g.code}`, code: g.code });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const c = e instanceof SocialError ? e.code : "server_error";
    if (!(e instanceof SocialError)) console.error(e);
    return NextResponse.json({ error: MESSAGES[c] ?? "Couldn't send the invite." }, { status: e instanceof SocialError ? e.status : 500 });
  }
}
