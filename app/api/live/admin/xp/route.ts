import { NextResponse, type NextRequest } from "next/server";
import { lockerStore } from "@/lib/db/liveLocker";
import { levelInfo } from "@/lib/live/locker";
import { isSiteOwner } from "@/lib/owner";
import { getSession } from "@/lib/session";

/**
 * Site owner only: find people with a Live locker and give them XP.
 * GET ?q=name → people. POST { userId, mode: "add" | "set", amount } → their new XP.
 */
const MAX_XP = 100_000_000;

async function owner() {
  const session = await getSession();
  return session && isSiteOwner(session.user.id) ? session : null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await owner())) return NextResponse.json({ error: "Only the site owner can do this." }, { status: 403 });
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 40);
  const rows = await lockerStore().search(q, 50);
  return NextResponse.json(
    { people: rows.map((r) => ({ userId: r.user_id, username: r.username ?? null, xp: r.xp, level: levelInfo(r.xp).level })) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await owner();
  if (!session) return NextResponse.json({ error: "Only the site owner can do this." }, { status: 403 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { userId?: unknown; mode?: unknown; amount?: unknown };
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const amount = Math.round(Number(body.amount));
  if (!userId || userId.length > 80) return NextResponse.json({ error: "Pick someone." }, { status: 400 });
  if (!Number.isFinite(amount) || Math.abs(amount) > MAX_XP) return NextResponse.json({ error: `Amounts go up to ${MAX_XP.toLocaleString()}.` }, { status: 400 });
  const store = lockerStore();
  const cur = await store.get(userId);
  const xp = body.mode === "set" ? Math.max(0, amount) : Math.min(MAX_XP, Math.max(0, cur.xp + amount));
  await store.setXp(userId, xp, userId === session.user.id ? session.user.username : null);
  return NextResponse.json({ userId, xp, level: levelInfo(xp).level });
}
