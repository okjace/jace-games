import "server-only";
import { themeStore } from "./db/themes";
import { getThemeChoice } from "./db/siteSettings";
import { getPrefs } from "./db/userPrefs";
import { activeSeason, isSeasonId, type SeasonId } from "./seasons";

/**
 * How Jace Live's emails look: the same colors as the site in the theme the
 * person picked (a season, the site's current theme, or their own custom
 * theme), light or dark like they have the site, with Jace Live's logo.
 * Jace puts these in its email template (the "theme" on POST /api/oauth/email).
 */

export type EmailTheme = {
  background: string;
  card: string;
  line: string;
  text: string;
  muted: string;
  accent: string;
  on_accent: string;
  logo_url: string;
  home_url: string;
};

/** Each season's [accent, background, panel, line] (the same as app/globals.css). */
const SEASON_COLORS: Partial<Record<SeasonId, [string, string, string, string]>> = {
  plain: ["#1f9d5a", "#f4f5f7", "#ffffff", "#dfe2e7"],
  fall: ["#d9580d", "#fbefe2", "#fffaf3", "#efd6b8"],
  halloween: ["#e8590c", "#f7efe6", "#fffaf4", "#e9d6c2"],
  thanksgiving: ["#c26a09", "#faf0e1", "#fffaf1", "#ecd5b3"],
  christmas: ["#d42d2d", "#eef7f1", "#fcfffd", "#cfe5d7"],
  winter: ["#1d8fd0", "#edf4fb", "#fbfdff", "#d0e0ef"],
  newyear: ["#b8860b", "#f6f3ea", "#fffdf7", "#e4dcc6"],
  lunar: ["#c8262a", "#fbefea", "#fffaf7", "#efd0c6"],
  valentines: ["#d63384", "#fdeef4", "#fffafc", "#f3cfe0"],
  stpatricks: ["#178a46", "#edf7ef", "#fbfffc", "#cbe4d2"],
  spring: ["#d6408a", "#fbf0f6", "#fffbfd", "#efd5e3"],
  easter: ["#8a4fd6", "#f6f0fd", "#fdfbff", "#e2d6f2"],
  earth: ["#178a46", "#edf6f0", "#fbfffc", "#cde3d4"],
  summer: ["#d97706", "#fdf6e3", "#fffdf6", "#f0e1b8"],
  july4: ["#2459d6", "#eef2fb", "#fbfcff", "#d2dcf2"],
  school: ["#b8860b", "#f8f5ea", "#fffef8", "#e6dfc8"],
  space: ["#6d4fd6", "#f1effc", "#fcfbff", "#dad3f4"],
  ocean: ["#0b8fa8", "#eaf7f9", "#fafeff", "#c6e6ec"],
  candy: ["#d63384", "#fdeef7", "#fffafd", "#f2cfe4"],
  neon: ["#b62fd1", "#f8effc", "#fefaff", "#ead2f3"],
  retro: ["#4d7c0f", "#f3f5ea", "#fdfef8", "#dde3c9"],
};

/** color-mix(in srgb, a k%, b), like the site's dark mode. */
function mix(a: string, b: string, k: number): string {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2].map((i) => Math.round(ch(a, i) * k + ch(b, i) * (1 - k)).toString(16).padStart(2, "0")).join("")}`;
}

/** The site's dark mode for a theme: tinted with its accent (app/globals.css). */
function darken(t: EmailTheme, own?: { background: string; panel: string; line: string; text: string } | null): EmailTheme {
  return {
    ...t,
    background: own?.background ?? mix(t.accent, "#0c0d11", 0.09),
    card: own?.panel ?? mix(t.accent, "#16171d", 0.11),
    line: own?.line ?? mix(t.accent, "#272a33", 0.24),
    text: own?.text ?? "#eceef2",
    muted: "#a3a9b4",
  };
}

const hex = (v: unknown, fallback: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);

export async function emailThemeFor(userId: string, siteUrl: string): Promise<EmailTheme> {
  const base = { text: "#1b1d23", muted: "#5d6470", on_accent: "#ffffff", logo_url: `${siteUrl}/brand/jace-games-icon-180.png`, home_url: siteUrl };
  const plain = SEASON_COLORS.plain ?? ["#1f9d5a", "#f4f5f7", "#ffffff", "#dfe2e7"];
  const fromSeason = (id: SeasonId) => {
    const [accent, background, card, line] = SEASON_COLORS[id] ?? plain;
    return { ...base, accent, background, card, line };
  };
  try {
    const prefs = await getPrefs(userId).catch(() => null);
    const dark = prefs?.look === "dark";
    const light = await lightTheme(prefs?.theme ?? "site");
    return dark ? darken(light.theme, light.dark) : light.theme;
  } catch {
    return fromSeason("plain" as SeasonId);
  }

  async function lightTheme(choice: string): Promise<{ theme: EmailTheme; dark?: { background: string; panel: string; line: string; text: string } | null }> {
    // Their own custom theme.
    const custom = /^custom:([0-9a-f-]{36})$/i.exec(choice);
    if (custom) {
      const t = await themeStore.get(custom[1]).catch(() => null);
      const c = t?.data?.colors;
      if (c) {
        const dk = t?.data?.dark;
        return {
          theme: { ...base, accent: hex(c.accent, plain[0]), background: hex(c.background, plain[1]), card: hex(c.panel, plain[2]), line: hex(c.line, plain[3]), text: hex(c.text, base.text), muted: hex(c.muted, base.muted) },
          dark: dk ? { background: hex(dk.background, "#121318"), panel: hex(dk.panel, "#1a1c23"), line: hex(dk.line, "#2b2e38"), text: hex(dk.text, "#eceef2") } : null,
        };
      }
    }
    if (isSeasonId(choice)) return { theme: fromSeason(choice) };
    // "site": whatever the site is showing right now.
    return { theme: fromSeason(activeSeason(await getThemeChoice().catch(() => "auto" as const))) };
  }
}
