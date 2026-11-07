import "server-only";
import { supabase, usingSupabase } from "./rooms";
import type { MapRow, TowerMap } from "@/lib/live/maps";

/** Storage for Tower Siege maps (supabase/migrations/007_live_maps.sql); in memory during development without Supabase. */

export type MapSummary = Omit<MapRow, "data"> & { data: Pick<TowerMap, "cols" | "rows" | "theme"> & { pathLength: number } };

export interface MapStore {
  create(m: Pick<MapRow, "owner_id" | "owner_name" | "title" | "data" | "visibility">): Promise<MapRow>;
  get(id: string): Promise<MapRow | null>;
  update(id: string, patch: Partial<MapRow>): Promise<MapRow | null>;
  remove(id: string): Promise<void>;
  mine(owner: string): Promise<MapRow[]>;
  publicMaps(limit: number): Promise<MapRow[]>;
  addPlay(id: string): Promise<void>;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

const supabaseStore: MapStore = {
  async create(m) {
    return check(await supabase().from("live_maps").insert(m).select().single()) as MapRow;
  },
  async get(id) {
    return (check(await supabase().from("live_maps").select().eq("id", id).maybeSingle()) as MapRow | null) ?? null;
  },
  async update(id, patch) {
    const rows = check(await supabase().from("live_maps").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).select()) as MapRow[];
    return rows[0] ?? null;
  },
  async remove(id) {
    check(await supabase().from("live_maps").delete().eq("id", id));
  },
  async mine(owner) {
    return check(await supabase().from("live_maps").select().eq("owner_id", owner).order("updated_at", { ascending: false }).limit(100)) as MapRow[];
  },
  async publicMaps(limit) {
    return check(await supabase().from("live_maps").select().eq("visibility", "public").eq("removed", false).order("plays", { ascending: false }).limit(limit)) as MapRow[];
  },
  async addPlay(id) {
    const m = await this.get(id);
    if (m) await supabase().from("live_maps").update({ plays: m.plays + 1 }).eq("id", id);
  },
};

const g = globalThis as unknown as { __jgMaps?: Map<string, MapRow> };
const mem = () => (g.__jgMaps ??= new Map());
const clone = <T,>(v: T): T => (v === null || v === undefined ? v : JSON.parse(JSON.stringify(v)));

const memoryStore: MapStore = {
  async create(m) {
    const now = new Date().toISOString();
    const row: MapRow = { ...clone(m), id: crypto.randomUUID(), mode: "tower", plays: 0, removed: false, created_at: now, updated_at: now };
    mem().set(row.id, row);
    return clone(row);
  },
  async get(id) {
    return clone(mem().get(id) ?? null);
  },
  async update(id, patch) {
    const m = mem().get(id);
    if (!m) return null;
    Object.assign(m, clone(patch), { updated_at: new Date().toISOString() });
    return clone(m);
  },
  async remove(id) {
    mem().delete(id);
  },
  async mine(owner) {
    return clone([...mem().values()].filter((m) => m.owner_id === owner).sort((a, b) => b.updated_at.localeCompare(a.updated_at)));
  },
  async publicMaps(limit) {
    return clone([...mem().values()].filter((m) => m.visibility === "public" && !m.removed).sort((a, b) => b.plays - a.plays).slice(0, limit));
  },
  async addPlay(id) {
    const m = mem().get(id);
    if (m) m.plays++;
  },
};

export function mapStore(): MapStore {
  if (usingSupabase()) return supabaseStore;
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
  return memoryStore;
}

/** A map without its full road, for lists. */
export function summarize(m: MapRow): MapSummary {
  return { ...m, data: { cols: m.data.cols, rows: m.data.rows, theme: m.data.theme, pathLength: m.data.path.length } };
}
