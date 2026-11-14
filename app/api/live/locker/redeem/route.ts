import { NextResponse, type NextRequest } from "next/server";
import { grantedOf, lockerStore } from "@/lib/db/liveLocker";
import { ITEM_KINDS, itemGrant, itemOf, levelInfo, type ItemKind } from "@/lib/live/locker";
import { getSession } from "@/lib/session";

/** POST { kind, id }: spend a free pick to unlock one locker item. */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { kind?: unknown; id?: unknown };
  const kind = (ITEM_KINDS as readonly string[]).includes(String(body.kind)) ? (body.kind as ItemKind) : null;
  const item = kind && typeof body.id === "string" ? itemOf(kind, body.id) : undefined;
  if (!kind || !item || !item.id) return NextResponse.json({ error: "That item doesn't exist." }, { status: 400 });
  const store = lockerStore();
  const row = await store.get(session.user.id);
  const granted = grantedOf(row);
  if ((row.stats?.vouchers ?? 0) < 1) return NextResponse.json({ error: "u dont have any free picks." }, { status: 409 });
  if (item.level <= levelInfo(row.xp).level || granted.includes(itemGrant(kind, item.id))) return NextResponse.json({ error: "u already have that one!" }, { status: 409 });
  await store.setGranted(session.user.id, [...granted, itemGrant(kind, item.id)]);
  await store.addStats(session.user.id, (s) => ({ ...s, vouchers: Math.max(0, (s.vouchers ?? 0) - 1) }));
  return NextResponse.json({ ok: true, item: item.name });
}
