import { NextResponse, type NextRequest } from "next/server";
import { usingSupabase } from "@/lib/db/rooms";
import { devBus } from "@/lib/realtime/devBus";

/**
 * Development-only live channel (see lib/realtime/devBus.ts).
 * GET ?topic=&key=&meta= streams events as SSE; POST {topic, event, payload} publishes.
 */
function disabled() {
  return process.env.NODE_ENV === "production" || usingSupabase();
}

export async function GET(req: NextRequest): Promise<Response> {
  if (disabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const topic = req.nextUrl.searchParams.get("topic") ?? "";
  const key = req.nextUrl.searchParams.get("key");
  const meta = JSON.parse(req.nextUrl.searchParams.get("meta") || "null");
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let ping: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(controller) {
      const send = (msg: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
      unsubscribe = devBus().subscribe(topic, key ? { key, meta } : null, send);
      ping = setInterval(() => controller.enqueue(encoder.encode(": ping\n\n")), 15_000);
      req.signal.addEventListener("abort", () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      clearInterval(ping);
      unsubscribe();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (disabled()) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const { topic, event, payload } = (await req.json()) as { topic: string; event: string; payload: unknown };
  devBus().publish(topic, event, payload);
  return NextResponse.json({ ok: true });
}
