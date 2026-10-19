import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode, getUserInfo } from "@/lib/jace";
import { redirectUri, safeNext } from "@/lib/routes";
import {
  STATE_COOKIE,
  clearSessionCookie,
  clearStateCookie,
  setSessionCookie,
  unseal,
} from "@/lib/session";

function sameState(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Jace redirects here with ?code&state. Exchange the code on the server and start a session. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = req.nextUrl.searchParams;
  const saved = unseal<{ state: string; next: string }>(req.cookies.get(STATE_COOKIE)?.value);
  const fail = (error: string) => {
    const res = NextResponse.redirect(new URL(`/?error=${error}`, req.url));
    clearStateCookie(res);
    return res;
  };

  if (params.get("error")) return fail(params.get("error") === "access_denied" ? "denied" : "signin");
  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !saved || !sameState(state, saved.state)) return fail("state");

  try {
    const token = await exchangeCode(code, redirectUri(req));
    const info = await getUserInfo(token);
    if (info.banned) {
      const res = fail("banned");
      clearSessionCookie(res);
      return res;
    }
    const next = safeNext(saved.next);
    const res = NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}signedin=1`, req.url));
    clearStateCookie(res);
    setSessionCookie(res, {
      token,
      user: { id: info.sub, username: info.username, picture: info.picture },
      iat: Date.now(),
    });
    return res;
  } catch (err) {
    console.error("Sign in with Jace failed:", err);
    return fail("signin");
  }
}
