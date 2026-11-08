import { NextResponse, type NextRequest } from "next/server";
import { uploadStore } from "@/lib/db/liveUploads";
import { UPLOAD, UPLOAD_PATH } from "@/lib/live/media";

/** An uploaded picture or video: a redirect to the Storage bucket (or, in development, the file itself). */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/live/media/[...path]">): Promise<NextResponse> {
  const { path: parts } = await ctx.params;
  const path = parts.join("/");
  if (!UPLOAD_PATH.test(path)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const found = await uploadStore().locate(path);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if ("redirect" in found) {
    return NextResponse.redirect(found.redirect, { status: 307, headers: { "Cache-Control": "public, max-age=86400" } });
  }
  const type = UPLOAD.types[found.type] ? found.type : "application/octet-stream";
  return new NextResponse(new Blob([found.body as BlobPart], { type }), {
    headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
