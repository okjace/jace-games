import "server-only";
import { cleanTheme, type ThemeSummary } from "@/lib/customThemes";
import { themeStore, type ThemeRow } from "@/lib/db/themes";
import { getPrefs, savePrefs } from "@/lib/db/userPrefs";
import { isSiteOwner } from "@/lib/owner";
import type { Session } from "@/lib/session";
import { emailUser, siteEmail } from "@/lib/email";
import { allow } from "@/lib/rateLimit";

/** The rules for custom themes and the theme market (see lib/customThemes.ts). */

export class ThemeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const MAX_THEMES = 50;
export const summary = (t: ThemeRow): ThemeSummary => ({ id: t.id, owner_id: t.owner_id, owner_name: t.owner_name, name: t.name, icon: t.icon, published: t.published, installs: t.installs, likes: t.likes ?? 0, removed: t.removed, updated_at: t.updated_at, data: t.data });

export async function createTheme(session: Session, raw: unknown) {
  const mine = await themeStore.byOwner(session.user.id);
  if (mine.length >= MAX_THEMES) throw new ThemeError(`u can have ${MAX_THEMES} themes. delete one first!`);
  const data = cleanTheme(raw);
  return summary(await themeStore.create(session.user.id, session.user.displayName || session.user.username, data));
}

/** A theme anyone can see if it's on the market; otherwise only its maker (and the site owner). */
export async function viewTheme(id: string, session: Session | null) {
  const t = await themeStore.get(id);
  const uid = session?.user.id ?? null;
  if (!t || ((!t.published || t.removed) && t.owner_id !== uid && !isSiteOwner(uid))) throw new ThemeError("That theme doesn't exist.", 404);
  return summary(t);
}

export async function saveTheme(session: Session, id: string, body: Record<string, unknown>) {
  const t = await themeStore.get(id);
  if (!t) throw new ThemeError("That theme doesn't exist.", 404);
  const owner = isSiteOwner(session.user.id);
  if (t.owner_id !== session.user.id) {
    // The site owner can only take market themes down (or put them back).
    if (owner && typeof body.removed === "boolean") {
      const updated = summary((await themeStore.update(id, { removed: body.removed, updated_at: t.updated_at }))!);
      if (body.removed !== t.removed) {
        emailUser(t.owner_id, "moderation", {
          subject: body.removed ? `Ur theme ${t.name} was taken off the market` : `Ur theme ${t.name} is back on the market`,
          heading: body.removed ? "🛡️ theme taken down" : "✅ theme is back",
          message: body.removed
            ? `A moderator took ${t.icon} ${t.name} off the theme market, usually because it broke the rules after someone reported it. U still have it, n u can still use it urself.\n\nIf u think it was a mistake, change what might be wrong n reach out to the Jace Live team.`
            : `Good news: ${t.icon} ${t.name} is back on the theme market.`,
          button: { label: "Open ur themes", url: "/themes" },
        });
      }
      return updated;
    }
    throw new ThemeError("Thats not ur theme.", 403);
  }
  const patch: Partial<ThemeRow> = {};
  if (body.data !== undefined) {
    const data = cleanTheme(body.data);
    Object.assign(patch, { data, name: data.name, icon: data.icon });
  }
  if (typeof body.published === "boolean") patch.published = body.published;
  // Publishing a remix: the theme it came from's maker hears about it (once, the first time).
  const remixOf = (patch.data ?? t.data)?.remixOf;
  if (patch.published && !t.published && remixOf?.id && allow(`remix-email:${t.id}`, 1, 7 * 86_400_000)) {
    const from = await themeStore.get(remixOf.id).catch(() => null);
    if (from && from.owner_id !== session.user.id) {
      emailUser(from.owner_id, "community", {
        subject: `${t.owner_name} remixed ur theme ${from.name}`,
        heading: "🎨 ur theme got remixed!",
        message: `${t.owner_name} made their own version of ${from.icon} ${from.name}, called ${patch.name ?? t.name}, n put it on the theme market.`,
        button: { label: "See the theme market", url: "/themes" },
      });
    }
  }
  if (owner && typeof body.removed === "boolean") patch.removed = body.removed;
  return summary((await themeStore.update(id, patch))!);
}

export async function deleteTheme(session: Session, id: string) {
  const t = await themeStore.get(id);
  if (!t) return;
  if (t.owner_id !== session.user.id && !isSiteOwner(session.user.id)) throw new ThemeError("Thats not ur theme.", 403);
  await themeStore.remove(id);
}

/** Install a market theme: it joins ur themes (saved to ur account). */
export async function installTheme(session: Session, id: string) {
  const t = await viewTheme(id, session);
  const prefs = (await getPrefs(session.user.id)) ?? {};
  const installed = prefs.installed ?? [];
  if (!installed.includes(id) && t.owner_id !== session.user.id) {
    await savePrefs(session.user.id, { ...prefs, installed: [id, ...installed].slice(0, 60) });
    await themeStore.addInstall(id);
  }
  return t;
}

export async function uninstallTheme(session: Session, id: string) {
  const prefs = (await getPrefs(session.user.id)) ?? {};
  await savePrefs(session.user.id, { ...prefs, installed: (prefs.installed ?? []).filter((x) => x !== id), theme: prefs.theme === `custom:${id}` ? "site" : prefs.theme });
}

/** Ur themes: the ones u made and the ones u installed. */
export async function myThemes(session: Session) {
  const [made, prefs] = await Promise.all([themeStore.byOwner(session.user.id), getPrefs(session.user.id)]);
  const installed = (await themeStore.many(prefs?.installed ?? [])).filter((t) => !t.removed || t.owner_id === session.user.id);
  return { made: made.map(summary), installed: installed.map(summary) };
}

export async function reportTheme(session: Session, id: string, reason: unknown) {
  await viewTheme(id, session);
  const why = typeof reason === "string" ? reason.replace(/[<>]/g, "").trim().slice(0, 300) : "";
  if (!why) throw new ThemeError("Say whats wrong with it.");
  const fresh = await themeStore.report(id, session.user.id, why);
  if (fresh) {
    const t = await themeStore.get(id);
    siteEmail("reports", {
      subject: `New report: theme ${t?.name ?? id}`,
      heading: "🚩 a theme was reported",
      message: `${session.user.username} reported the theme ${t?.icon ?? ""} ${t?.name ?? id} (by ${t?.owner_name ?? "someone"}).\n\nWhy: ${why}`,
      button: { label: "Review themes", url: "/themes" },
    });
  }
  return fresh;
}
