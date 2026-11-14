export const primary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--accent)] to-[color-mix(in_srgb,var(--accent)_70%,var(--accent2))] px-6 text-sm font-semibold text-on-accent shadow-[0_4px_14px_-4px_color-mix(in_srgb,var(--accent)_70%,transparent)] transition-[filter,transform] hover:-rotate-1 hover:scale-[1.04] hover:brightness-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50";
export const secondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-panel px-5 text-sm font-medium shadow-sm transition-[color,background-color,border-color,transform] hover:rotate-1 hover:scale-[1.04] hover:border-accent/40 hover:bg-accent/[.06] active:scale-95 disabled:opacity-50";
export const input =
  "h-11 w-full rounded-xl border border-line bg-background/60 px-3 text-sm outline-none transition-colors focus:border-accent focus:bg-panel";
export const card = "rounded-3xl border border-line bg-panel p-5 shadow-[0_10px_30px_-18px_rgba(30,20,10,0.25)]";

export const ANSWER_COLORS = ["#e5484d", "#2f80ed", "#e2a500", "#26a269"];
export const ANSWER_SHAPES = ["▲", "◆", "●", "■"];

/** The player's secret token for a game, kept in this browser only. */
export const tokenKey = (code: string) => `jace-games:live:${code}`;
export function getToken(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}
export function setToken(code: string, token: string | null) {
  try {
    if (token) localStorage.setItem(tokenKey(code), token);
    else localStorage.removeItem(tokenKey(code));
  } catch {}
}

/** A guest's rejoin PIN for a game (shown so they can get back in from another device). */
const pinKey = (code: string) => `jace-games:live:pin:${code}`;
export function getPin(code: string): string | null {
  try {
    return localStorage.getItem(pinKey(code));
  } catch {
    return null;
  }
}
export function setPin(code: string, pin: string | null) {
  try {
    if (pin) localStorage.setItem(pinKey(code), pin);
    else localStorage.removeItem(pinKey(code));
  } catch {}
}

/** Game codes this browser has joined (newest first isn't known, so in storage order). */
export function joinedCodes(): string[] {
  try {
    return Object.keys(localStorage)
      .map((k) => k.match(/^jace-games:live:(\d{6})$/)?.[1])
      .filter((c): c is string => !!c);
  } catch {
    return [];
  }
}
