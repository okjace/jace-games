import { NextResponse } from "next/server";
import { profileStore } from "@/lib/db/profiles";
import { JaceUnauthorized, getUserInfo } from "@/lib/jace";
import { allow } from "@/lib/rateLimit";
import { clearSessionCookie, getSession, setSessionCookie } from "@/lib/session";

/**
 * "Update from Jace": reads the account from Jace again right now, saves a
 * new username or picture into the session, and puts a new username on
 * everything this person made (sets, maps, Studio games, scores).
 */
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace first." }, { status: 401 });
  if (!allow(`profile-refresh:${session.user.id}`, 6, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  let info;
  try {
    info = await getUserInfo(session.token);
  } catch (e) {
    if (e instanceof JaceUnauthorized) {
      const res = NextResponse.json({ error: "Your Jace sign-in expired. Sign in again." }, { status: 401 });
      clearSessionCookie(res);
      return res;
    }
    return NextResponse.json({ error: "Couldn't reach Jace. Try again in a moment." }, { status: 503 });
  }
  if (info.banned) {
    const res = NextResponse.json({ error: "This Jace account is banned." }, { status: 403 });
    clearSessionCookie(res);
    return res;
  }
  const before = session.user;
  const renamed = await profileStore()
    .rename(info.sub, info.username)
    .catch(() => 0);
  const user = { id: info.sub, username: info.username, picture: info.picture, displayName: before.displayName ?? "" };
  const res = NextResponse.json({
    user,
    usernameChanged: before.username !== info.username ? { from: before.username, to: info.username } : null,
    pictureChanged: before.picture !== info.picture,
    renamed,
  });
  setSessionCookie(res, { ...session, user });
  return res;
}
