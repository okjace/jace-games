import { NextResponse } from "next/server";
import { JaceUnauthorized, JaceUnavailable, getUserInfo } from "@/lib/jace";
import { clearSessionCookie, getSession, setSessionCookie } from "@/lib/session";

/**
 * Re-checks the signed-in account with Jace (called once per page load).
 * A ban or a revoked token signs the person out; a new username or avatar
 * is saved into the session.
 */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ user: null });
  try {
    const info = await getUserInfo(session.token);
    if (info.banned) {
      const res = NextResponse.json({ user: null, banned: true });
      clearSessionCookie(res);
      return res;
    }
    const user = { id: info.sub, username: info.username, picture: info.picture };
    const res = NextResponse.json({ user });
    if (user.username !== session.user.username || user.picture !== session.user.picture) {
      setSessionCookie(res, { ...session, user });
    }
    return res;
  } catch (err) {
    if (err instanceof JaceUnauthorized) {
      const res = NextResponse.json({ user: null, signedOut: true });
      clearSessionCookie(res);
      return res;
    }
    if (err instanceof JaceUnavailable) return NextResponse.json({ user: session.user, offline: true });
    throw err;
  }
}
