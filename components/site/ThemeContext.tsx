"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { isSeasonId, type SeasonId } from "@/lib/seasons";

/**
 * Which theme this viewer sees: the site's (picked by the date, or by the
 * site owner) unless they chose their own, remembered on this device. Plus
 * their special modes (chaos, chill, retro TV…), which are classes on <html>.
 * HEAD_SCRIPT applies both before the page draws so nothing flashes.
 */

export const MY_THEME_KEY = "jace-live:my-theme";
export const MY_MODES_KEY = "jace-live:modes";

export const SPECIAL_MODES = [
  { id: "chaos", name: "🌀 chaos mode", blurb: "3× the falling stuff, n random easter eggs" },
  { id: "chill", name: "🧘 chill mode", blurb: "no moving decorations. just vibes" },
  { id: "crt", name: "📺 retro TV", blurb: "scanlines n a fuzzy old screen" },
  { id: "comic", name: "💬 comic mode", blurb: "evrything in a comic font" },
  { id: "rainbow", name: "🌈 rainbow mode", blurb: "colors slowly cycle forever" },
  { id: "bigtext", name: "🔠 big text", blurb: "bigger words, easier reading" },
] as const;
export type SpecialMode = (typeof SPECIAL_MODES)[number]["id"];

/** Runs in <head> before anything draws. */
export const HEAD_SCRIPT = `try{var d=document.documentElement,t=localStorage.getItem("${MY_THEME_KEY}");if(t&&t!=="site")d.dataset.season=t;JSON.parse(localStorage.getItem("${MY_MODES_KEY}")||"[]").forEach(function(m){d.classList.add("jl-mode-"+m)})}catch(e){}`;

const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());
const subscribe = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};

function readTheme(): string {
  try {
    return localStorage.getItem(MY_THEME_KEY) ?? "site";
  } catch {
    return "site";
  }
}
let modesCache: { raw: string; list: SpecialMode[] } = { raw: "", list: [] };
function readModes(): SpecialMode[] {
  try {
    const raw = localStorage.getItem(MY_MODES_KEY) ?? "[]";
    if (raw !== modesCache.raw) modesCache = { raw, list: (JSON.parse(raw) as string[]).filter((m): m is SpecialMode => SPECIAL_MODES.some((s) => s.id === m)) };
  } catch {}
  return modesCache.list;
}

export function setMyTheme(choice: SeasonId | "site") {
  try {
    localStorage.setItem(MY_THEME_KEY, choice);
  } catch {}
  notify();
  pushPrefs();
}

// ---------- Saved to ur account (when signed in) ----------

const EFFECTS_KEY = "jace-live:effects-off";
let prefsListeners: (() => void)[] = [];
/** Other stores (the falling-stuff switch) re-read when account settings arrive. */
export function onPrefsLoaded(fn: () => void) {
  prefsListeners.push(fn);
  return () => {
    prefsListeners = prefsListeners.filter((f) => f !== fn);
  };
}

/** Saves this device's theme settings to ur account (ignored when signed out). */
export function pushPrefs() {
  try {
    const body = { theme: readTheme(), modes: readModes(), effectsOff: localStorage.getItem(EFFECTS_KEY) === "1" };
    void fetch("/api/me/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  } catch {}
}

/** On page load: use the settings saved to ur account (or save this device's, the first time). */
export async function loadPrefs() {
  const res = await fetch("/api/me/prefs", { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return;
  const { prefs } = (await res.json().catch(() => ({}))) as { prefs?: { theme?: string; modes?: string[]; effectsOff?: boolean } | null };
  if (!prefs) return pushPrefs();
  try {
    if (typeof prefs.theme === "string") localStorage.setItem(MY_THEME_KEY, prefs.theme);
    if (Array.isArray(prefs.modes)) {
      localStorage.setItem(MY_MODES_KEY, JSON.stringify(prefs.modes));
      for (const m of SPECIAL_MODES) document.documentElement.classList.toggle(`jl-mode-${m.id}`, prefs.modes.includes(m.id));
    }
    if (typeof prefs.effectsOff === "boolean") localStorage.setItem(EFFECTS_KEY, prefs.effectsOff ? "1" : "0");
  } catch {}
  notify();
  prefsListeners.forEach((f) => f());
}
export function toggleMode(m: SpecialMode) {
  const cur = readModes();
  const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
  try {
    localStorage.setItem(MY_MODES_KEY, JSON.stringify(next));
  } catch {}
  document.documentElement.classList.toggle(`jl-mode-${m}`, next.includes(m));
  notify();
  pushPrefs();
}

const SiteSeason = createContext<SeasonId>("plain");

export function SeasonProvider({ season, children }: { season: SeasonId; children: ReactNode }) {
  return <SiteSeason.Provider value={season}>{children}</SiteSeason.Provider>;
}

/** The site's own theme (before any personal choice). */
export const useSiteSeason = () => useContext(SiteSeason);

/** What this viewer chose ("site" means follow the site). */
export function useMyThemeChoice(): string {
  return useSyncExternalStore(subscribe, readTheme, () => "site");
}

/** The theme this viewer sees, kept in sync on <html data-season>. */
export function useSeason(): SeasonId {
  const site = useSiteSeason();
  const mine = useMyThemeChoice();
  const season = mine !== "site" && isSeasonId(mine) ? mine : site;
  useEffect(() => {
    document.documentElement.dataset.season = season;
  }, [season]);
  return season;
}

const NO_MODES: SpecialMode[] = [];
export function useModes(): SpecialMode[] {
  return useSyncExternalStore(subscribe, readModes, () => NO_MODES);
}
