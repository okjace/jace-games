import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl } from "@/lib/jace";
import { redirectUri, safeNext } from "@/lib/routes";
import { setStateCookie } from "@/lib/session";

/** Starts "Sign in with Jace": remembers a random state, then sends the browser to Jace. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const state = randomBytes(24).toString("base64url");
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const res = NextResponse.redirect(authorizeUrl({ redirectUri: redirectUri(req), state }));
  setStateCookie(res, { state, next });
  return res;
}
