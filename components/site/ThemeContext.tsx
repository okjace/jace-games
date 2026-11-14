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
}
export function toggleMode(m: SpecialMode) {
  const cur = readModes();
  const next = cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m];
  try {
    localStorage.setItem(MY_MODES_KEY, JSON.stringify(next));
  } catch {}
  document.documentElement.classList.toggle(`jl-mode-${m}`, next.includes(m));
  notify();
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
