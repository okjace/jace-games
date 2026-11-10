import { NextResponse, type NextRequest } from "next/server";
import { liveStore } from "@/lib/db/live";
import { setReportStore } from "@/lib/db/liveSetReports";
import { isSiteOwner } from "@/lib/owner";
import { getSession } from "@/lib/session";

/**
 * Site owner only. GET: reported sets, most reported first, with every
 * reason. DELETE ?set=id: dismiss the reports on a set. (Taking a set down
 * or putting it back is PATCH /api/live/sets/[id] { removed }.)
 */
async function owner() {
  const session = await getSession();
  return session && isSiteOwner(session.user.id) ? session : null;
}

export async function GET(): Promise<NextResponse> {
  if (!(await owner())) return NextResponse.json({ error: "Only the site owner can see reports." }, { status: 403 });
  const reports = await setReportStore().all(500);
  const bySet = new Map<string, typeof reports>();
  for (const r of reports) bySet.set(r.set_id, [...(bySet.get(r.set_id) ?? []), r]);
  const sets = await Promise.all(
    [...bySet.entries()].map(async ([setId, rs]) => {
      const set = await liveStore().getSet(setId);
      return {
        setId,
        title: set?.title ?? "(deleted set)",
        owner: set?.owner_name ?? "",
        visibility: set?.visibility ?? "",
        removed: !!set?.removed,
        questions: set?.questions.length ?? 0,
        reports: rs.map((r) => ({ by: r.reporter_name, reason: r.reason, at: r.created_at })),
      };
    }),
  );
  sets.sort((a, b) => b.reports.length - a.reports.length);
  return NextResponse.json({ sets }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  if (!(await owner())) return NextResponse.json({ error: "Only the site owner can do this." }, { status: 403 });
  const setId = req.nextUrl.searchParams.get("set") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(setId)) return NextResponse.json({ error: "Which set?" }, { status: 400 });
  await setReportStore().dismiss(setId);
  return NextResponse.json({ ok: true });
}
