import "server-only";
import { randomUUID } from "crypto";
import type { ThemeData, ThemeSummary } from "@/lib/customThemes";
import { supabase, usingSupabase } from "./rooms";

/** Custom themes and the theme market (supabase/migrations/025_user_themes.sql); in memory during development without Supabase. */

export type ThemeRow = ThemeSummary & { created_at: string };
export type ThemeReport = { id: string; theme_id: string; reporter_id: string; reason: string; created_at: string };

const g = globalThis as unknown as { __jlThemes?: Map<string, ThemeRow>; __jlThemeReports?: ThemeReport[]; __jlThemeLikes?: { theme_id: string; user_id: string; created_at: string }[] };
const memLikes = () => (g.__jlThemeLikes ??= []);
export type MarketSort = "trending" | "popular" | "liked" | "new";
const mem = () => (g.__jlThemes ??= new Map());
const memReports = () => (g.__jlThemeReports ??= []);
const dev = () => {
  if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
};
function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export const themeStore = {
  async create(owner_id: string, owner_name: string, data: ThemeData): Promise<ThemeRow> {
    const now = new Date().toISOString();
    const row = { owner_id, owner_name, name: data.name, icon: data.icon, data, published: false, installs: 0, removed: false };
    if (!usingSupabase()) {
      dev();
      const r: ThemeRow = { ...row, id: randomUUID(), created_at: now, updated_at: now };
      mem().set(r.id, r);
      return r;
    }
    return check(await supabase().from("user_themes").insert(row).select().single()) as ThemeRow;
  },
  async get(id: string): Promise<ThemeRow | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    if (!usingSupabase()) return mem().get(id) ?? null;
    return (check(await supabase().from("user_themes").select().eq("id", id).maybeSingle()) as ThemeRow | null) ?? null;
  },
  async update(id: string, patch: Partial<ThemeRow>): Promise<ThemeRow | null> {
    const p = { updated_at: new Date().toISOString(), ...patch };
    if (!usingSupabase()) {
      const cur = mem().get(id);
      if (!cur) return null;
      const next = { ...cur, ...p };
      mem().set(id, next);
      return next;
    }
    const rows = check(await supabase().from("user_themes").update(p).eq("id", id).select()) as ThemeRow[];
    return rows[0] ?? null;
  },
  async remove(id: string): Promise<void> {
    if (!usingSupabase()) {
      mem().delete(id);
      return;
    }
    check(await supabase().from("user_themes").delete().eq("id", id));
  },
  async byOwner(owner: string): Promise<ThemeRow[]> {
    if (!usingSupabase()) return [...mem().values()].filter((t) => t.owner_id === owner).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return check(await supabase().from("user_themes").select().eq("owner_id", owner).order("updated_at", { ascending: false }).limit(100)) as ThemeRow[];
  },
  async many(ids: string[]): Promise<ThemeRow[]> {
    const ok = ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 100);
    if (!ok.length) return [];
    if (!usingSupabase()) return ok.map((id) => mem().get(id)).filter((t): t is ThemeRow => !!t);
    return check(await supabase().from("user_themes").select().in("id", ok)) as ThemeRow[];
  },
  async market(sort: MarketSort, q: string): Promise<ThemeRow[]> {
    // Trending: likes from the last week count most, then all likes and installs.
    const trending = async (rows: ThemeRow[]) => {
      const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const recent = usingSupabase()
        ? ((check(await supabase().from("theme_likes").select("theme_id").gt("created_at", since).limit(5000)) as { theme_id: string }[]) ?? [])
        : memLikes().filter((l) => l.created_at > since);
      const week = new Map<string, number>();
      for (const l of recent) week.set(l.theme_id, (week.get(l.theme_id) ?? 0) + 1);
      const score = (t: ThemeRow) => (week.get(t.id) ?? 0) * 3 + (t.likes ?? 0) * 0.5 + t.installs * 0.2;
      return [...rows].sort((a, b) => score(b) - score(a));
    };
    if (!usingSupabase()) {
      const rows = [...mem().values()].filter((t) => t.published && !t.removed && (!q || t.name.toLowerCase().includes(q.toLowerCase())));
      if (sort === "trending") return (await trending(rows)).slice(0, 60);
      return rows.sort((a, b) => (sort === "new" ? b.updated_at.localeCompare(a.updated_at) : sort === "liked" ? (b.likes ?? 0) - (a.likes ?? 0) : b.installs - a.installs)).slice(0, 60);
    }
    let query = supabase().from("user_themes").select().eq("published", true).eq("removed", false);
    if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
    if (sort === "trending") return (await trending(check(await query.order("updated_at", { ascending: false }).limit(300)) as ThemeRow[])).slice(0, 60);
    query = sort === "new" ? query.order("updated_at", { ascending: false }) : sort === "liked" ? query.order("likes", { ascending: false }) : query.order("installs", { ascending: false });
    return check(await query.limit(60)) as ThemeRow[];
  },
  /** Like (or unlike) a theme; returns its new like count. One like per person. */
  async like(theme_id: string, user_id: string, on: boolean): Promise<number> {
    if (!usingSupabase()) {
      const list = memLikes();
      const i = list.findIndex((l) => l.theme_id === theme_id && l.user_id === user_id);
      if (on && i < 0) list.push({ theme_id, user_id, created_at: new Date().toISOString() });
      if (!on && i >= 0) list.splice(i, 1);
      const likes = list.filter((l) => l.theme_id === theme_id).length;
      const t = mem().get(theme_id);
      if (t) mem().set(theme_id, { ...t, likes });
      return likes;
    }
    if (on) {
      const res = await supabase().from("theme_likes").insert({ theme_id, user_id });
      if (res.error && res.error.code !== "23505") throw new Error(res.error.message);
    } else check(await supabase().from("theme_likes").delete().eq("theme_id", theme_id).eq("user_id", user_id));
    // Count again (not +1/-1), so the number is always right.
    const { count } = await supabase().from("theme_likes").select("theme_id", { count: "exact", head: true }).eq("theme_id", theme_id);
    const likes = count ?? 0;
    check(await supabase().from("user_themes").update({ likes }).eq("id", theme_id));
    return likes;
  },
  /** Which of these themes the person has liked. */
  async likedBy(user_id: string, ids: string[]): Promise<Set<string>> {
    if (!ids.length) return new Set();
    if (!usingSupabase()) return new Set(memLikes().filter((l) => l.user_id === user_id && ids.includes(l.theme_id)).map((l) => l.theme_id));
    const rows = check(await supabase().from("theme_likes").select("theme_id").eq("user_id", user_id).in("theme_id", ids.slice(0, 100))) as { theme_id: string }[];
    return new Set(rows.map((r) => r.theme_id));
  },
  async addInstall(id: string): Promise<void> {
    const t = await this.get(id);
    if (t) await this.update(id, { installs: t.installs + 1, updated_at: t.updated_at });
  },
  /** False if this person already reported it. */
  async report(theme_id: string, reporter_id: string, reason: string): Promise<boolean> {
    if (!usingSupabase()) {
      if (memReports().some((r) => r.theme_id === theme_id && r.reporter_id === reporter_id)) return false;
      memReports().push({ id: randomUUID(), theme_id, reporter_id, reason, created_at: new Date().toISOString() });
      return true;
    }
    const res = await supabase().from("theme_reports").insert({ theme_id, reporter_id, reason });
    if (res.error) {
      if (res.error.code === "23505") return false;
      throw new Error(res.error.message);
    }
    return true;
  },
  async reports(): Promise<(ThemeReport & { theme: ThemeRow | null })[]> {
    const rows: ThemeReport[] = usingSupabase() ? (check(await supabase().from("theme_reports").select().order("created_at", { ascending: false }).limit(200)) as ThemeReport[]) : [...memReports()].reverse();
    const themes = await this.many([...new Set(rows.map((r) => r.theme_id))]);
    return rows.map((r) => ({ ...r, theme: themes.find((t) => t.id === r.theme_id) ?? null }));
  },
};
