import { NextResponse, type NextRequest } from "next/server";
import { uploadStore } from "@/lib/db/liveUploads";
import { getUserInfo } from "@/lib/jace";
import { UPLOAD } from "@/lib/live/media";
import { allow } from "@/lib/rateLimit";
import { getSession } from "@/lib/session";

/**
 * Start an upload: { type, size } → { path, uploadUrl }. The browser then
 * PUTs the file to uploadUrl. Signed-in set makers only, a limited number a
 * day, and only pictures (8 MB) and videos (50 MB) of the allowed types.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Jace to upload." }, { status: 401 });
  if (!allow(`live-upload:${session.user.id}`, 10, 60_000)) return NextResponse.json({ error: "Slow down a little!" }, { status: 429 });
  const body = ((await req.json().catch(() => null)) ?? {}) as { type?: unknown; size?: unknown };
  const type = typeof body.type === "string" ? body.type : "";
  const info = UPLOAD.types[type];
  if (!info) return NextResponse.json({ error: "Upload a picture (PNG, JPG, GIF or WebP) or a video (MP4, WebM or MOV)." }, { status: 400 });
  const size = Number(body.size);
  const max = info.kind === "image" ? UPLOAD.maxImageBytes : UPLOAD.maxVideoBytes;
  if (!Number.isInteger(size) || size <= 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (size > max) return NextResponse.json({ error: `${info.kind === "image" ? "Pictures" : "Videos"} can be at most ${max / 1024 / 1024} MB.` }, { status: 413 });

  const user = await getUserInfo(session.token).catch(() => null);
  if (user?.banned || user?.muted) return NextResponse.json({ error: "This Jace account can't upload right now." }, { status: 403 });

  const store = uploadStore();
  try {
    const since = new Date(Date.now() - 86_400_000).toISOString();
    if ((await store.countSince(session.user.id, since)) >= UPLOAD.perDay) {
      return NextResponse.json({ error: `You can upload ${UPLOAD.perDay} files a day. Try again tomorrow.` }, { status: 429 });
    }
    const folder = session.user.id.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 64) || "user";
    const path = `${folder}/${crypto.randomUUID()}.${info.ext}`;
    const { uploadUrl } = await store.begin({ user_id: session.user.id, path, type, bytes: size });
    return NextResponse.json({ path, uploadUrl, kind: info.kind });
  } catch {
    return NextResponse.json({ error: "Uploads aren't working right now. Try again in a bit." }, { status: 503 });
  }
}
