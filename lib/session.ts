import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { SessionUser } from "./types";

/**
 * The session is one encrypted, HTTP-only cookie holding the Jace access
 * token and the profile from userinfo. AES-256-GCM with a key derived from
 * SESSION_SECRET, so the browser can neither read the token nor forge a
 * session. There's no server-side session store to run.
 */

export const SESSION_COOKIE = "jg_session";
export const STATE_COOKIE = "jg_oauth_state";
// Jace access tokens last 365 days; keep the cookie a little shorter.
const SESSION_MAX_AGE = 60 * 60 * 24 * 360;

export type Session = {
  token: string;
  user: SessionUser;
  /** Unix ms when the session was created. */
  iat: number;
};

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to at least 32 characters (see README.md).");
  }
  return createHash("sha256").update(secret).digest();
}

export function seal(data: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function unseal<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    const raw = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const text = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

/** The current session, or null. For server components and route handlers. */
export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const session = unseal<Session>(store.get(SESSION_COOKIE)?.value);
  return session?.token && session.user?.id ? session : null;
}

export function setSessionCookie(res: NextResponse, session: Session): void {
  res.cookies.set(SESSION_COOKIE, seal(session), { ...cookieOptions, maxAge: SESSION_MAX_AGE });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}

export function setStateCookie(res: NextResponse, value: { state: string; next: string }): void {
  res.cookies.set(STATE_COOKIE, seal(value), { ...cookieOptions, maxAge: 10 * 60 });
}

export function clearStateCookie(res: NextResponse): void {
  res.cookies.set(STATE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}
