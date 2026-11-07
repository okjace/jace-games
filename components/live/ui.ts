export const primary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50";
export const secondary =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line bg-panel px-5 text-sm font-medium transition-colors hover:bg-foreground/[.05] disabled:opacity-50";
export const input =
  "h-11 w-full rounded-xl border border-line bg-background px-3 text-sm outline-none focus:border-accent";
export const card = "rounded-2xl border border-line bg-panel p-5";

/** Kahoot-style answer colors, also used on the host screen. */
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
