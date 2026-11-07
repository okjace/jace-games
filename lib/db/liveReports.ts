import "server-only";
import { supabase, usingSupabase } from "./rooms";
import type { GameReport } from "@/lib/live/report";

/** Saved Live reports (supabase/migrations/010_live_reports.sql); in memory during development without Supabase. */

export type ReportRow = { id: string; host_id: string; code: string; mode: string; set_title: string | null; data: GameReport; created_at: string; expires_at: string };

export interface ReportStore {
  save(r: Pick<ReportRow, "host_id" | "code" | "mode" | "set_title" | "data">): Promise<void>;
  get(id: string): Promise<ReportRow | null>;
  mine(host: string): Promise<ReportRow[]>;
  remove(id: string): Promise<void>;
  deleteExpired(now: string): Promise<number>;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const supabaseStore: ReportStore = {
  async save(r) {
    check(await supabase().from("live_reports").insert(r));
  },
  async get(id) {
    return (check(await supabase().from("live_reports").select().eq("id", id).maybeSingle()) as ReportRow | null) ?? null;
  },
  async mine(host) {
    return check(await supabase().from("live_reports").select().eq("host_id", host).order("created_at", { ascending: false }).limit(100)) as ReportRow[];
  },
  async remove(id) {
    check(await supabase().from("live_reports").delete().eq("id", id));
  },
  async deleteExpired(now) {
    return (check(await supabase().from("live_reports").delete().lt("expires_at", now).select("id")) as { id: string }[]).length;
  },
};

const g = globalThis as unknown as { __jgReports?: Map<string, ReportRow> };
const mem = () => (g.__jgReports ??= new Map());

const memoryStore: ReportStore = {
  async save(r) {
    const now = new Date();
    const row: ReportRow = { ...structuredClone(r), id: crypto.randomUUID(), created_at: now.toISOString(), expires_at: new Date(now.getTime() + 90 * 86_400_000).toISOString() };
    mem().set(row.id, row);
  },
  async get(id) {
    const r = mem().get(id);
    return r ? structuredClone(r) : null;
  },
  async mine(host) {
    return [...mem().values()].filter((r) => r.host_id === host).sort((a, b) => b.created_at.localeCompare(a.created_at)).map((r) => structuredClone(r));
  },
  async remove(id) {
    mem().delete(id);
  },
  async deleteExpired(now) {
    let n = 0;
    for (const [id, r] of mem()) if (r.expires_at < now && mem().delete(id)) n++;
    return n;
  },
};

export function reportStore(): ReportStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
  return memoryStore;
}
