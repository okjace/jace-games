import { NextResponse, type NextRequest } from "next/server";
import { uploadStore } from "@/lib/db/liveUploads";
import { UPLOAD_PATH, typeForExt } from "@/lib/live/media";

/**
 * An uploaded picture, video or sound: a redirect to the Storage bucket (or,
 * in development, the file itself). ?download=<name> saves it as a file
 * (a theme's music, from ur theme settings) instead of showing it.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/live/media/[...path]">): Promise<NextResponse> {
  const { path: parts } = await ctx.params;
  const path = parts.join("/");
  if (!UPLOAD_PATH.test(path)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const ext = path.split(".").pop() ?? "";
  // A safe file name: letters, numbers, spaces, dashes, then the real extension.
  const asked = req.nextUrl.searchParams.get("download");
  const name = asked !== null ? `${asked.replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, 60) || "jace-live-music"}.${ext}` : null;
  const found = await uploadStore().locate(path);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if ("redirect" in found) {
    const to = name ? `${found.redirect}?download=${encodeURIComponent(name)}` : found.redirect;
    return NextResponse.redirect(to, { status: 307, headers: { "Cache-Control": "public, max-age=86400" } });
  }
  const type = typeForExt[ext] ?? "application/octet-stream";
  return new NextResponse(new Blob([found.body as BlobPart], { type }), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      ...(name ? { "Content-Disposition": `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}` } : {}),
    },
  });
}
