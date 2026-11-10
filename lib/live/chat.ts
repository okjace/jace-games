/**
 * Live game chat: what a message may contain. Messages are short, links
 * are blocked, and common rude words are starred out. Shared by the server
 * (which cleans every message) and the browser.
 */

export const CHAT_MAX = 200;
export const CHAT_GAP_MS = 2000;

export type ChatMessage = { id: string; name: string; host: boolean; text: string; at: string; mine?: boolean };

const RUDE = ["damn", "hell", "crap", "stupid", "idiot", "dumb", "shut up", "loser", "sucks", "wtf", "stfu", "fuck", "shit", "bitch", "ass", "bastard", "piss"];
const rudeRe = new RegExp(`\\b(${RUDE.map((w) => w.replace(/ /g, "\\s+")).join("|")})\\b`, "gi");

/** A chat message made safe, or null if nothing is left. */
export function cleanChat(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const text = raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CHAT_MAX)
    // no links: people could send each other anywhere
    .replace(/\b((https?:\/\/|www\.)\S+|\S+\.(com|net|org|io|gg|co|app|xyz|me|ly|tv)(\/\S*)?)/gi, "[link]")
    .replace(rudeRe, (w) => w[0] + "*".repeat(Math.max(1, w.length - 1)));
  return text ? text : null;
}
