import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

const SAYS: Record<string, string> = {
  sent: "sent! it can take a couple minutes to show up (check spam too).",
  no_email: "ur Jace account doesnt have a confirmed email yet. add one in ur Jace settings first.",
  turned_off: "u turned off \"Emails from Jace's apps\" in ur Jace settings, so Jace didnt send it.",
  not_signed_up: "Jace doesnt know u signed in here yet. sign out n back in, then try again.",
  rate_limited: "too many emails today. try again tomorrow.",
  failed: "couldnt send it right now. try again in a bit.",
};

/** POST: emails me a test email (so I can check emails work). A few per hour. */
export async function POST(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!allow(`test-email:${session.user.id}`, 3, 3_600_000)) return NextResponse.json({ error: "u already sent a few test emails. try again in an hour." }, { status: 429 });
  const result = await sendEmail(session.user.id, null, {
    subject: "Ur test email from Jace Live",
    heading: "📬 emails work!",
    message: `Hi ${session.user.displayName || session.user.username}! This is the test email u asked for. If ur reading this, Jace Live emails r getting to u.\n\nU can pick which emails u get in ur profile on Jace Live.`,
    button: { label: "Open ur email settings", url: "/profile" },
  });
  return NextResponse.json({ result, message: SAYS[result] ?? SAYS.failed }, { status: result === "sent" ? 200 : result === "failed" ? 502 : 200 });
}
