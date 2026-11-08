/**
 * Pictures and videos on Live questions, and the plain-text form of a
 * question's markdown. Shared by the server (which checks every link before
 * saving a set) and the browser (the editor and the players' screens).
 *
 * Videos are stored as an id, never a raw URL, and only ever embedded from
 * youtube-nocookie.com or player.vimeo.com. Pictures must be https links.
 */

export type QuestionMedia =
  | { kind: "image"; url: string; alt: string }
  | { kind: "youtube"; id: string; start: number }
  | { kind: "vimeo"; id: string };

export const MAX_MEDIA = 3;

/** Turns a pasted link into media, or says why it can't be used. */
export function parseMediaLink(raw: string, alt = ""): { ok: true; media: QuestionMedia } | { ok: false; error: string } {
  const text = raw.trim();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "That doesn't look like a link. Paste the whole address, starting with https://" };
  }
  if (url.protocol !== "https:") return { ok: false, error: "Links have to start with https://" };
  const host = url.hostname.replace(/^www\.|^m\./, "");

  // YouTube: watch?v=, youtu.be/, /shorts/, /embed/, /live/.
  if (host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const id =
      host === "youtu.be"
        ? url.pathname.slice(1).split("/")[0]
        : (url.searchParams.get("v") ?? url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/)?.[1] ?? "");
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return { ok: false, error: "Couldn't find the video in that YouTube link." };
    const t = url.searchParams.get("t") ?? url.searchParams.get("start") ?? "0";
    const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    const start = m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
    return { ok: true, media: { kind: "youtube", id, start: Math.min(start, 86_400) } };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const id = url.pathname.match(/(\d{5,12})/)?.[1];
    if (!id) return { ok: false, error: "Couldn't find the video in that Vimeo link." };
    return { ok: true, media: { kind: "vimeo", id } };
  }
  // Anything else is treated as a picture.
  if (text.length > 1000 || /["'<>\s\\]/.test(text)) return { ok: false, error: "That picture link is too long or has odd characters in it." };
  return { ok: true, media: { kind: "image", url: url.toString(), alt: alt.trim().slice(0, 120) } };
}

/** Checks media from a request. Anything that isn't valid is dropped. */
export function cleanMedia(raw: unknown): QuestionMedia[] {
  if (!Array.isArray(raw)) return [];
  const out: QuestionMedia[] = [];
  for (const r of raw.slice(0, 20)) {
    if (out.length >= MAX_MEDIA) break;
    const m = (r ?? {}) as Record<string, unknown>;
    if (m.kind === "youtube" && typeof m.id === "string" && /^[A-Za-z0-9_-]{11}$/.test(m.id)) {
      out.push({ kind: "youtube", id: m.id, start: Number.isInteger(m.start) ? Math.min(86_400, Math.max(0, m.start as number)) : 0 });
    } else if (m.kind === "vimeo" && typeof m.id === "string" && /^\d{5,12}$/.test(m.id)) {
      out.push({ kind: "vimeo", id: m.id });
    } else if (m.kind === "image" && typeof m.url === "string") {
      const p = parseMediaLink(m.url, typeof m.alt === "string" ? m.alt : "");
      if (p.ok && p.media.kind === "image") out.push(p.media);
    }
  }
  return out;
}

/** Where a video plays from. */
export function embedUrl(m: QuestionMedia): string | null {
  if (m.kind === "youtube") return `https://www.youtube-nocookie.com/embed/${m.id}?rel=0${m.start ? `&start=${m.start}` : ""}`;
  if (m.kind === "vimeo") return `https://player.vimeo.com/video/${m.id}?dnt=1`;
  return null;
}

/** Markdown as plain words: for spreadsheets, short labels and anywhere formatting can't show. */
export function plainText(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (b) => b.replace(/```\w*\n?/g, ""))
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|~~|==)(.+?)\1/g, "$2")
    .replace(/(\*|_)(.+?)\1/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}(#{1,3}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}
