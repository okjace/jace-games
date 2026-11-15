"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { isSeasonId, type SeasonId } from "@/lib/seasons";
import { cleanTheme, registerCustom, themeCss, type ThemeData, type ThemeSummary } from "@/lib/customThemes";

/**
 * Which theme this viewer sees: the site's (picked by the date, or by the
 * site owner) unless they chose their own, remembered on this device. Plus
 * their special modes (chaos, chill, retro TV…), which are classes on <html>.
 * HEAD_SCRIPT applies both before the page draws so nothing flashes.
 */

export const MY_THEME_KEY = "jace-live:my-theme";
export const MY_MODES_KEY = "jace-live:modes";
/** Light, dark or auto (follows the computer). */
export const LOOK_KEY = "jace-live:look";
export type Look = "light" | "dark" | "auto";
/** The custom theme in use ({ id, data }) and its CSS, kept so the page can show it before anything loads. */
const CUSTOM_KEY = "jace-live:custom-theme";
const CUSTOM_CSS_KEY = "jace-live:custom-css";

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
export const HEAD_SCRIPT = `try{var d=document.documentElement,l=localStorage.getItem("${LOOK_KEY}");if(l==="dark"||(l==="auto"&&matchMedia("(prefers-color-scheme: dark)").matches))d.dataset.theme="dark";var t=localStorage.getItem("${MY_THEME_KEY}");if(t&&t.indexOf("custom:")===0){var c=localStorage.getItem("${CUSTOM_CSS_KEY}");if(c){var s=document.createElement("style");s.id="jl-custom-css";s.textContent=c;document.head.appendChild(s);d.dataset.season="custom"}}else if(t&&t!=="site")d.dataset.season=t;JSON.parse(localStorage.getItem("${MY_MODES_KEY}")||"[]").forEach(function(m){d.classList.add("jl-mode-"+m)})}catch(e){}`;

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

// ---------- Light / dark ----------

function readLook(): Look {
  try {
    const v = localStorage.getItem(LOOK_KEY);
    return v === "dark" || v === "auto" ? v : "light";
  } catch {
    return "light";
  }
}
function applyLook(look: Look) {
  const dark = look === "dark" || (look === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}
export function setLook(look: Look) {
  try {
    localStorage.setItem(LOOK_KEY, look);
  } catch {}
  applyLook(look);
  notify();
  pushPrefs();
}
export function useLook(): Look {
  const look = useSyncExternalStore(subscribe, readLook, () => "light" as Look);
  // "Auto" follows the computer, even when it switches while the page is open.
  useEffect(() => {
    applyLook(look);
    if (look !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const change = () => applyLook("auto");
    mq.addEventListener("change", change);
    return () => mq.removeEventListener("change", change);
  }, [look]);
  return look;
}

// ---------- Custom themes ----------

let customCache: { raw: string; theme: { id: string; data: ThemeData } | null } = { raw: "", theme: null };
function readCustom(): { id: string; data: ThemeData } | null {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY) ?? "";
    if (raw !== customCache.raw) {
      const parsed = raw ? (JSON.parse(raw) as { id: string; data: unknown }) : null;
      customCache = { raw, theme: parsed ? { id: parsed.id, data: cleanTheme(parsed.data) } : null };
    }
  } catch {}
  return customCache.theme;
}

/** Puts a custom theme's colours and CSS on the page (or takes them off). */
function applyCustomCss(t: ThemeData | null) {
  let el = document.getElementById("jl-custom-css");
  if (!t) return el?.remove();
  if (!el) {
    el = document.createElement("style");
    el.id = "jl-custom-css";
    document.head.appendChild(el);
  }
  el.textContent = themeCss(t);
}

/** Use a custom theme (one u made or installed). */
export function pickCustomTheme(t: ThemeSummary) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify({ id: t.id, data: t.data }));
    localStorage.setItem(CUSTOM_CSS_KEY, themeCss(t.data));
    localStorage.setItem(MY_THEME_KEY, `custom:${t.id}`);
  } catch {}
  applyCustomCss(t.data);
  notify();
  pushPrefs();
}

/** While editing in the theme maker: show it right away without saving anything. */
export function previewCustomTheme(data: ThemeData | null) {
  previewData = data;
  applyCustomCss(data ?? readCustom()?.data ?? null);
  notify();
}
let previewData: ThemeData | null = null;
const previewSub = () => previewData;

export function setMyTheme(choice: SeasonId | "site") {
  try {
    localStorage.setItem(MY_THEME_KEY, choice);
  } catch {}
  applyCustomCss(null);
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
    const body = { theme: readTheme(), modes: readModes(), effectsOff: localStorage.getItem(EFFECTS_KEY) === "1", look: readLook() };
    void fetch("/api/me/prefs", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
  } catch {}
}

/** On page load: use the settings saved to ur account (or save this device's, the first time). */
export async function loadPrefs() {
  const res = await fetch("/api/me/prefs", { cache: "no-store" }).catch(() => null);
  if (!res?.ok) return;
  const { prefs } = (await res.json().catch(() => ({}))) as { prefs?: { theme?: string; modes?: string[]; effectsOff?: boolean; look?: Look } | null };
  if (!prefs) return pushPrefs();
  // A custom theme from the account: fetch it (it may have changed since this device last saw it).
  if (typeof prefs.theme === "string" && prefs.theme.startsWith("custom:")) {
    const r = await fetch(`/api/themes/${prefs.theme.slice(7)}`, { cache: "no-store" }).catch(() => null);
    const body = await r?.json().catch(() => null);
    if (r?.ok && body?.theme) {
      try {
        localStorage.setItem(CUSTOM_KEY, JSON.stringify({ id: body.theme.id, data: body.theme.data }));
        localStorage.setItem(CUSTOM_CSS_KEY, themeCss(cleanTheme(body.theme.data)));
      } catch {}
      applyCustomCss(cleanTheme(body.theme.data));
    } else prefs.theme = "site";
  } else applyCustomCss(null);
  try {
    if (typeof prefs.theme === "string") localStorage.setItem(MY_THEME_KEY, prefs.theme);
    if (Array.isArray(prefs.modes)) {
      localStorage.setItem(MY_MODES_KEY, JSON.stringify(prefs.modes));
      for (const m of SPECIAL_MODES) document.documentElement.classList.toggle(`jl-mode-${m.id}`, prefs.modes.includes(m.id));
    }
    if (typeof prefs.effectsOff === "boolean") localStorage.setItem(EFFECTS_KEY, prefs.effectsOff ? "1" : "0");
    if (prefs.look === "light" || prefs.look === "dark" || prefs.look === "auto") {
      localStorage.setItem(LOOK_KEY, prefs.look);
      applyLook(prefs.look);
    }
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

/** The theme this viewer sees, kept in sync on <html data-season>. A custom theme shows as "custom". */
export function useSeason(): SeasonId {
  const site = useSiteSeason();
  const mine = useMyThemeChoice();
  const preview = useSyncExternalStore(subscribe, previewSub, () => null);
  const custom = useSyncExternalStore(subscribe, readCustom, () => null);
  let season: SeasonId = mine !== "site" && isSeasonId(mine) ? mine : site;
  const live = preview ?? (mine.startsWith("custom:") && custom && `custom:${custom.id}` === mine ? custom.data : null);
  if (live) {
    registerCustom(live);
    season = "custom" as SeasonId;
  }
  useEffect(() => {
    document.documentElement.dataset.season = season;
  }, [season]);
  return season;
}

const NO_MODES: SpecialMode[] = [];
export function useModes(): SpecialMode[] {
  return useSyncExternalStore(subscribe, readModes, () => NO_MODES);
}

/** The custom theme in use (id), if any, so its pieces can restart when it changes. */
export function useCustomKey(): string {
  const preview = useSyncExternalStore(subscribe, previewSub, () => null);
  const custom = useSyncExternalStore(subscribe, readCustom, () => null);
  return preview ? `preview-${JSON.stringify(preview).length}-${preview.name}` : (custom?.id ?? "");
}
