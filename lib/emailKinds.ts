/**
 * The kinds of email Jace Live can send, and whether each is on until
 * someone changes it. Shared by the server (lib/email.ts) and the profile's
 * email settings card.
 */
export const EMAIL_KINDS = {
  community: { label: "💖 likes, remixes n records", desc: "someone remixed ur theme, ur theme or Studio game hit a milestone, or someone beat ur top score", on: true },
  moderation: { label: "🛡️ stuff about ur creations", desc: "if a moderator takes down (or puts back) one of ur themes, Studio games or sets", on: true },
  gameReports: { label: "📊 game reports", desc: "after a game with questions that u host or play solo: how evryone did on each question", on: false },
  games: { label: "🏁 game recaps", desc: "after a hosted game u played in ends: ur place, ur score n the replay", on: false },
  weekly: { label: "🗓️ weekly challenge results", desc: "every Monday, how u did in last week's challenge (only if u played it)", on: false },
  reports: { label: "🚩 new reports", desc: "moderators only: when someone reports a game, theme or set", on: true },
} as const;

export type EmailKind = keyof typeof EMAIL_KINDS;
export type EmailPrefs = Partial<Record<EmailKind, boolean>>;

export const isEmailKind = (k: unknown): k is EmailKind => typeof k === "string" && k in EMAIL_KINDS;

/** Whether someone gets this kind of email (their choice, or the default). */
export const emailOn = (prefs: EmailPrefs | undefined, kind: EmailKind) => prefs?.[kind] ?? EMAIL_KINDS[kind].on;
