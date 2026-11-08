import { NextResponse, type NextRequest } from "next/server";
import { devPut } from "@/lib/db/liveUploads";
import { usingSupabase } from "@/lib/db/rooms";
import { getSession } from "@/lib/session";

/** Development only (no Supabase): receives the file the browser PUTs. In production files go straight to Storage. */
export async function PUT(req: NextRequest): Promise<NextResponse> {
  if (usingSupabase() || process.env.NODE_ENV === "production") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const path = req.nextUrl.searchParams.get("path") ?? "";
  const body = new Uint8Array(await req.arrayBuffer());
  const problem = devPut(path, session.user.id, body);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  return NextResponse.json({ ok: true });
}
