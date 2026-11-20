import "server-only";
import { after } from "next/server";
import { getPrefs } from "./db/userPrefs";
import { JACE_URL } from "./jace";
import { emailOn, type EmailKind } from "./emailKinds";
import { siteOwners } from "./owner";

/**
 * Emails a Jace Live player through Jace (POST /api/oauth/email with Jace
 * Live's client credentials). Jace puts it in its own template, adds "Jace
 * Live" to the subject and never shows us the address. Only for things the
 * person would want, and only the kinds they left on in their profile.
 * Sending happens after the response, so nobody waits on it, and it never
 * throws.
 */

export type Email = {
  subject: string;
  /** Plain text; blank lines separate paragraphs. */
  message: string;
  heading?: string;
  /** A path on Jace Live (like /replay/…) or a full https link. */
  button?: { label: string; url: string };
};

export const SITE_URL = (process.env.APP_URL || "https://jace-live.vercel.app").replace(/\/$/, "");
const link = (url: string) => (url.startsWith("/") ? `${SITE_URL}${url}` : url);

/** Jace user ids only (guests have none). */
const isJaceId = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length <= 80 && !id.startsWith("guest");

export type SendResult = "sent" | "no_email" | "turned_off" | "not_signed_up" | "rate_limited" | "off" | "failed";

/** Sends now and says what happened. `kind` null skips their email settings (a test they asked for). */
export async function sendEmail(userId: string, kind: EmailKind | null, email: Email): Promise<SendResult> {
  const id = process.env.JACE_CLIENT_ID;
  const secret = process.env.JACE_CLIENT_SECRET;
  if (!id || !secret || process.env.JACE_EMAIL_OFF === "1") return "failed";
  try {
    if (kind && !emailOn((await getPrefs(userId).catch(() => null))?.emails, kind)) return "off";
    const body: Record<string, string> = {
      user_id: userId,
      subject: email.subject.replace(/\s+/g, " ").trim().slice(0, 150),
      message: email.message.trim().slice(0, 5000),
    };
    if (email.heading) body.heading = email.heading.slice(0, 150);
    const url = email.button && link(email.button.url);
    // Jace only takes https buttons (a local test site just leaves the button off).
    if (email.button && url?.startsWith("https://")) {
      body.button_label = email.button.label.slice(0, 40);
      body.button_url = url;
    }
    const res = await fetch(`${JACE_URL}/api/oauth/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json().catch(() => null)) as { sent?: boolean; reason?: string } | null;
    if (res.ok && data?.sent) return "sent";
    // { sent: false } (no email, or they turned Jace app emails off) and 404 (never signed in here) are fine.
    if (res.ok && data?.reason === "no_email") return "no_email";
    if (res.ok && data?.reason === "turned_off") return "turned_off";
    if (res.status === 404) return "not_signed_up";
    if (res.status === 429) return "rate_limited";
    console.error(`Jace email (${kind ?? "test"}) failed: ${res.status}`);
    return "failed";
  } catch (e) {
    console.error("Jace email failed", e);
    return "failed";
  }
}

/** Emails someone after this response is sent (if they want this kind). */
export function emailUser(userId: unknown, kind: EmailKind, email: Email): void {
  if (!isJaceId(userId)) return;
  const job = () => sendEmail(userId, kind, email).then(() => {});
  try {
    after(job);
  } catch {
    // Outside a request (a script): just send it.
    void job();
  }
}

/** The same email to several people (each only once). */
export function emailUsers(userIds: unknown[], kind: EmailKind, email: (userId: string) => Email | null): void {
  for (const id of new Set(userIds.filter(isJaceId))) {
    const e = email(id);
    if (e) emailUser(id, kind, e);
  }
}

/** An email for the moderators (the site owners). */
export function siteEmail(kind: EmailKind, email: Email): void {
  emailUsers(siteOwners(), kind, () => email);
}

/** Round numbers worth an email (1, 10, 25, 50, 100, 250, 500, 1000, then every 1000). */
export function milestone(n: number): boolean {
  return [1, 10, 25, 50, 100, 250, 500].includes(n) || (n >= 1000 && n % 1000 === 0);
}
