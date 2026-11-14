import "server-only";
import { isThemeChoice, type ThemeChoice } from "@/lib/seasons";
import { supabase, usingSupabase } from "./rooms";

/** Site-wide settings (supabase/migrations/022_site_settings.sql); in memory during development without Supabase. */

const mem = globalThis as unknown as { __jlSettings?: Map<string, unknown> };
const memory = () => (mem.__jlSettings ??= new Map());

async function get(key: string): Promise<unknown> {
  if (!usingSupabase()) return memory().get(key) ?? null;
  const res = await supabase().from("site_settings").select("value").eq("key", key).maybeSingle();
  if (res.error) throw new Error(res.error.message);
  return (res.data as { value: unknown } | null)?.value ?? null;
}

async function set(key: string, value: unknown): Promise<void> {
  if (!usingSupabase()) {
    if (process.env.NODE_ENV === "production") throw new Error("Supabase must be configured in production.");
    memory().set(key, value);
    return;
  }
  const res = await supabase().from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() });
  if (res.error) throw new Error(res.error.message);
}

/** The site theme the owner picked ("auto" follows the calendar). Falls back to "auto" if it can't be read. */
export async function getThemeChoice(): Promise<ThemeChoice> {
  try {
    const v = await get("theme");
    return isThemeChoice(v) ? v : "auto";
  } catch {
    return "auto";
  }
}

export async function setThemeChoice(choice: ThemeChoice): Promise<void> {
  await set("theme", choice);
}
