import "server-only";
import { supabase, usingSupabase } from "./rooms";

/** Reports on question sets (supabase/migrations/016_live_set_reports.sql); in memory during development without Supabase. */

export type SetReportRow = { id: string; set_id: string; reporter_id: string; reporter_name: string; reason: string; created_at: string };

export interface SetReportStore {
  /** False if this person already reported this set. */
  add(r: Omit<SetReportRow, "id" | "created_at">): Promise<boolean>;
  /** Every open report, newest first. */
  all(limit: number): Promise<SetReportRow[]>;
  /** Clears the reports on a set (after reviewing it). */
  dismiss(setId: string): Promise<void>;
}

const supabaseStore: SetReportStore = {
  async add(r) {
    const res = await supabase().from("live_set_reports").insert(r);
    if (res.error?.code === "23505") return false;
    if (res.error) throw new Error(res.error.message);
    return true;
  },
  async all(limit) {
    const res = await supabase().from("live_set_reports").select().order("created_at", { ascending: false }).limit(limit);
    if (res.error) throw new Error(res.error.message);
    return res.data as SetReportRow[];
  },
  async dismiss(setId) {
    const res = await supabase().from("live_set_reports").delete().eq("set_id", setId);
    if (res.error) throw new Error(res.error.message);
  },
};

const g = globalThis as unknown as { __jgSetReports?: SetReportRow[] };
const mem = () => (g.__jgSetReports ??= []);

const memoryStore: SetReportStore = {
  async add(r) {
    if (mem().some((x) => x.set_id === r.set_id && x.reporter_id === r.reporter_id)) return false;
    mem().unshift({ ...r, id: crypto.randomUUID(), created_at: new Date().toISOString() });
    return true;
  },
  async all(limit) {
    return mem().slice(0, limit).map((r) => ({ ...r }));
  },
  async dismiss(setId) {
    g.__jgSetReports = mem().filter((r) => r.set_id !== setId);
  },
};

export function setReportStore(): SetReportStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
  return memoryStore;
}
