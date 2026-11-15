import { NextResponse } from "next/server";
import { callIce } from "@/lib/live/calls";
import { getSession } from "@/lib/session";

/** The relay servers for an in-game call (from Jace Social; short-lived). */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  return NextResponse.json({ iceServers: await callIce(session) }, { headers: { "Cache-Control": "no-store" } });
}
