import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { JaceNeedsScope, JaceUnauthorized, JaceUnavailable } from "./jace";
import { clearSessionCookie, getSession, type Session } from "./session";

/**
 * This app's origin as the browser sees it: APP_URL if set, otherwise from
 * the Host header (req.nextUrl.origin is always "localhost" in dev, even
 * when the page was opened on 127.0.0.1).
 */
export function appOrigin(req: NextRequest): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  return host ? `${proto}://${host}` : req.nextUrl.origin;
}

/** Where Jace sends people back to after signing in. Must be registered in Jace exactly. */
export function redirectUri(req: NextRequest): string {
  return `${appOrigin(req)}/api/auth/callback`;
}

/** Only same-site paths, so `next` can't be used as an open redirect. */
export function safeNext(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

/**
 * Runs a handler that needs the signed-in person's Jace token and maps Jace's
 * answers to ours: 401 signs them out, a missing endpoint becomes
 * `{ available: false }` ("coming soon"), and a token without the scores
 * scope becomes `{ needsReauth: true }`.
 */
export async function withJace(
  fn: (session: Session) => Promise<Record<string, unknown>>,
): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "signed_out" }, { status: 401 });
  try {
    return NextResponse.json({ available: true, ...(await fn(session)) });
  } catch (err) {
    if (err instanceof JaceUnauthorized) {
      const res = NextResponse.json({ error: "signed_out" }, { status: 401 });
      clearSessionCookie(res);
      return res;
    }
    if (err instanceof JaceNeedsScope) return NextResponse.json({ available: true, needsReauth: true });
    if (err instanceof JaceUnavailable) return NextResponse.json({ available: false });
    console.error(err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
