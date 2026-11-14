import { NextResponse } from "next/server";
import { themeStore } from "@/lib/db/themes";
import { isSiteOwner } from "@/lib/owner";
import { getSession } from "@/lib/session";
import { summary } from "@/lib/themesServer";

/** GET (site owner): reports about market themes, newest first. */
export async function GET(): Promise<NextResponse> {
  const session = await getSession();
  if (!session || !isSiteOwner(session.user.id)) return NextResponse.json({ error: "Only the site owner can see this." }, { status: 403 });
  const rows = await themeStore.reports();
  return NextResponse.json({ reports: rows.map((r) => ({ id: r.id, reason: r.reason, at: r.created_at, theme: r.theme ? summary(r.theme) : null })) });
}
