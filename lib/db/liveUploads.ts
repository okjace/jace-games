import "server-only";
import { supabase, supabaseUrl, usingSupabase } from "./rooms";

/**
 * Uploaded question media (supabase/migrations/011_live_uploads.sql).
 * Production: files in the public "live-media" Storage bucket, uploaded by
 * the browser with one-time signed links; a row per upload for the daily
 * limit. Development without Supabase: files kept in memory.
 */

export const BUCKET = "live-media";

export interface UploadStore {
  /** How many files this person uploaded since the given time. */
  countSince(userId: string, since: string): Promise<number>;
  /** Records an upload and returns where the browser should send the file. */
  begin(u: { user_id: string; path: string; type: string; bytes: number }): Promise<{ uploadUrl: string }>;
  /** Where to fetch a file from (production), or its bytes (development). */
  locate(path: string): Promise<{ redirect: string } | { body: Uint8Array; type: string } | null>;
}

const supabaseStore: UploadStore = {
  async countSince(userId, since) {
    const res = await supabase().from("live_uploads").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since);
    if (res.error) throw new Error(res.error.message);
    return res.count ?? 0;
  },
  async begin(u) {
    const ins = await supabase().from("live_uploads").insert(u);
    if (ins.error) throw new Error(ins.error.message);
    const { data, error } = await supabase().storage.from(BUCKET).createSignedUploadUrl(u.path);
    if (error || !data) throw new Error(error?.message ?? "Couldn't make an upload link.");
    return { uploadUrl: data.signedUrl };
  },
  async locate(path) {
    return { redirect: `${supabaseUrl()}/storage/v1/object/public/${BUCKET}/${path}` };
  },
};

// ---------- Development: in memory ----------

type MemFile = { user_id: string; type: string; bytes: number; created_at: string; body: Uint8Array | null };
const g = globalThis as unknown as { __jgUploads?: Map<string, MemFile> };
const mem = () => (g.__jgUploads ??= new Map());

const memoryStore: UploadStore = {
  async countSince(userId, since) {
    return [...mem().values()].filter((f) => f.user_id === userId && f.created_at >= since).length;
  },
  async begin(u) {
    mem().set(u.path, { user_id: u.user_id, type: u.type, bytes: u.bytes, created_at: new Date().toISOString(), body: null });
    return { uploadUrl: `/api/live/media/dev-upload?path=${encodeURIComponent(u.path)}` };
  },
  async locate(path) {
    const f = mem().get(path);
    return f?.body ? { body: f.body, type: f.type } : null;
  },
};

/** Development only: stores the bytes for a path handed out by begin(). */
export function devPut(path: string, userId: string, body: Uint8Array): string | null {
  const f = mem().get(path);
  if (!f || f.user_id !== userId) return "That upload link isn't yours.";
  if (f.body) return "That file was already uploaded.";
  if (body.byteLength > f.bytes + 1024) return "The file is bigger than you said.";
  f.body = body;
  return null;
}

export function uploadStore(): UploadStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
  return memoryStore;
}
