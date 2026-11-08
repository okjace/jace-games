"use client";

import { Fragment, useState, type ReactNode } from "react";
import { embedUrl, type QuestionMedia } from "@/lib/live/media";

/**
 * A small, safe markdown renderer for question text. It builds React
 * elements (never raw HTML), so a set can't inject anything into the page.
 *
 * Blocks: # / ## / ### headings, > quotes, - or * lists, 1. lists, ``` code
 * blocks, blank lines between paragraphs. Inline: **bold**, *italic* or
 * _italic_, ~~strike~~, ==highlight==, `code`, [text](https://link) and line
 * breaks. Links open in a new tab and must be http(s) or mailto.
 */

type Inline = { re: RegExp; render: (m: RegExpExecArray, key: string) => ReactNode };

const safeHref = (href: string) => (/^(https?:\/\/|mailto:)/i.test(href) ? href : null);

const INLINE: Inline[] = [
  { re: /`([^`\n]+)`/, render: (m, k) => <code key={k} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.9em] dark:bg-white/15">{m[1]}</code> },
  {
    re: /\[([^\]\n]+)\]\(([^)\s]+)\)/,
    render: (m, k) => {
      const href = safeHref(m[2]);
      return href ? (
        <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-2 underline-offset-2 hover:opacity-80" onClick={(e) => e.stopPropagation()}>
          {inline(m[1], k)}
        </a>
      ) : (
        <Fragment key={k}>{m[0]}</Fragment>
      );
    },
  },
  { re: /\*\*([^*\n]+)\*\*|__([^_\n]+)__/, render: (m, k) => <strong key={k}>{inline(m[1] ?? m[2], k)}</strong> },
  { re: /~~([^~\n]+)~~/, render: (m, k) => <del key={k}>{inline(m[1], k)}</del> },
  { re: /==([^=\n]+)==/, render: (m, k) => <mark key={k} className="rounded bg-yellow-300 px-0.5 text-neutral-900">{inline(m[1], k)}</mark> },
  { re: /\*([^*\n]+)\*|(?<![\w])_([^_\n]+)_(?![\w])/, render: (m, k) => <em key={k}>{inline(m[1] ?? m[2], k)}</em> },
];

/** Inline formatting inside one line or block. Picks the earliest match each time. */
function inline(text: string, keyBase = "i"): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    let best: { m: RegExpExecArray; rule: Inline } | null = null;
    for (const rule of INLINE) {
      const m = rule.re.exec(rest);
      if (m && (!best || m.index < best.m.index)) best = { m, rule };
    }
    if (!best) {
      out.push(rest);
      break;
    }
    if (best.m.index > 0) out.push(rest.slice(0, best.m.index));
    out.push(best.rule.render(best.m, `${keyBase}-${n++}`));
    rest = rest.slice(best.m.index + best.m[0].length);
  }
  return out;
}

/** Line breaks inside a paragraph become <br>. */
function lines(text: string, key: string): ReactNode[] {
  return text.split("\n").flatMap((line, i) => (i === 0 ? inline(line, `${key}-${i}`) : [<br key={`${key}-br${i}`} />, ...inline(line, `${key}-${i}`)]));
}

export function Markdown({ text, inline: inlineOnly = false, className = "" }: { text: string; inline?: boolean; className?: string }) {
  if (inlineOnly) return <span className={className}>{inline(text.replace(/\n+/g, " "))}</span>;
  const blocks: ReactNode[] = [];
  const src = text.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;
  let k = 0;
  while (i < src.length) {
    const line = src[i];
    const key = `b${k++}`;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const body: string[] = [];
      i++;
      while (i < src.length && !src[i].startsWith("```")) body.push(src[i++]);
      i++;
      blocks.push(
        <pre key={key} className="overflow-x-auto rounded-lg bg-black/80 p-3 text-left font-mono text-sm leading-relaxed text-green-200">
          {body.join("\n")}
        </pre>,
      );
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const size = ["text-[1.4em]", "text-[1.2em]", "text-[1.05em]"][h[1].length - 1];
      blocks.push(
        <p key={key} role="heading" aria-level={h[1].length + 2} className={`${size} font-black leading-tight`}>
          {inline(h[2], key)}
        </p>,
      );
      i++;
      continue;
    }
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < src.length && /^>\s?/.test(src[i])) body.push(src[i++].replace(/^>\s?/, ""));
      blocks.push(
        <blockquote key={key} className="border-l-4 border-current/40 pl-3 text-left italic opacity-90">
          {lines(body.join("\n"), key)}
        </blockquote>,
      );
      continue;
    }
    const bullet = /^\s*[-*+]\s+/;
    const numbered = /^\s*\d+[.)]\s+/;
    if (bullet.test(line) || numbered.test(line)) {
      const ordered = numbered.test(line);
      const re = ordered ? numbered : bullet;
      const items: string[] = [];
      while (i < src.length && re.test(src[i])) items.push(src[i++].replace(re, ""));
      const List = ordered ? "ol" : "ul";
      blocks.push(
        <List key={key} className={`${ordered ? "list-decimal" : "list-disc"} mx-auto inline-block pl-6 text-left`}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${key}-${j}`)}</li>
          ))}
        </List>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < src.length && src[i].trim() && !/^(```|#{1,3}\s|>|\s*[-*+]\s|\s*\d+[.)]\s)/.test(src[i])) para.push(src[i++]);
    blocks.push(<p key={key}>{lines(para.join("\n"), key)}</p>);
  }
  return <div className={`flex flex-col gap-2 [overflow-wrap:anywhere] ${className}`}>{blocks}</div>;
}

/** A question's pictures and videos. Videos play from YouTube's privacy-friendly domain or Vimeo. */
export function QuestionMediaView({ media, className = "" }: { media?: QuestionMedia[]; className?: string }) {
  if (!media?.length) return null;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {media.map((m, i) => {
        const src = embedUrl(m);
        if (src) {
          return (
            <div key={i} className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={src}
                title={m.kind === "youtube" ? "YouTube video" : "Vimeo video"}
                className="absolute inset-0 h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                loading="lazy"
              />
            </div>
          );
        }
        if (m.kind !== "image") return null;
        return <Picture key={i} url={m.url} alt={m.alt} />;
      })}
    </div>
  );
}

/** A picture from any https host (no referrer sent), with a placeholder if it won't load. */
function Picture({ url, alt }: { url: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <p className="mx-auto rounded-xl border border-dashed border-current/30 px-4 py-6 text-sm opacity-70">
        🖼️ This picture couldn&apos;t load{alt ? `: ${alt}` : "."}
      </p>
    );
  }
  return (
    // Pictures can be hosted anywhere, so a plain <img>.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="mx-auto max-h-80 w-auto max-w-full rounded-xl object-contain" />
  );
}
