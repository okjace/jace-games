/**
 * Display names: what people see, set on the profile page. The username
 * always comes from Jace and can't be changed here (it updates when it
 * changes on Jace). Shared by the server (which checks every name) and the
 * browser.
 */

export const DISPLAY_NAME_MAX = 24;

/** Names that could pass for staff or the site itself. */
const RESERVED = /\b(admin|administrator|moderator|mod team|jace ?(games|staff|team|support|official)|official|system|staff)\b/i;

/** A cleaned display name, "" to clear it (use the username), or why it can't be used. */
export function cleanDisplayName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, name: "" };
  if (typeof raw !== "string") return { ok: false, error: "Send the name as text." };
  const name = raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!name) return { ok: true, name: "" };
  if ([...name].length > DISPLAY_NAME_MAX) return { ok: false, error: `Display names can be at most ${DISPLAY_NAME_MAX} characters.` };
  if (name.startsWith("@")) return { ok: false, error: "Display names can't start with @ (that's for usernames)." };
  if (RESERVED.test(name)) return { ok: false, error: "That name could be mistaken for staff. Pick another." };
  return { ok: true, name };
}

/** What to call someone: their display name, or their username. */
export const shownName = (u: { username: string; displayName?: string | null }) => u.displayName || u.username;
