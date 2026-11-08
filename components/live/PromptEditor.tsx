"use client";

import { useRef, useState } from "react";
import { MAX_MEDIA, UPLOAD, parseMediaLink } from "@/lib/live/media";
import { LIMITS, type Question } from "@/lib/live/types";
import { Markdown, QuestionMediaView } from "./Markdown";
import { input } from "./ui";

/**
 * The question box with a markdown kit on top: buttons that wrap the
 * selected text (bold, italic, strike, highlight, code, link) or start a
 * line (heading, list, numbered list, quote, code block), a Preview toggle,
 * and a place to add pictures and YouTube or Vimeo videos.
 */

type Tool = { label: string; title: string; wrap?: [string, string]; line?: string; block?: [string, string]; className?: string };

const TOOLS: Tool[] = [
  { label: "B", title: "Bold (Ctrl+B)", wrap: ["**", "**"], className: "font-black" },
  { label: "I", title: "Italic (Ctrl+I)", wrap: ["*", "*"], className: "italic font-serif" },
  { label: "S", title: "Strikethrough", wrap: ["~~", "~~"], className: "line-through" },
  { label: "H", title: "Highlight", wrap: ["==", "=="], className: "bg-yellow-300 text-neutral-900 rounded px-0.5" },
  { label: "</>", title: "Code", wrap: ["`", "`"], className: "font-mono text-[11px]" },
  { label: "🔗", title: "Link (Ctrl+K)", wrap: ["[", "](https://)"] },
  { label: "Title", title: "Heading", line: "## " },
  { label: "•", title: "Bulleted list", line: "- " },
  { label: "1.", title: "Numbered list", line: "1. " },
  { label: "❝", title: "Quote", line: "> " },
  { label: "{ }", title: "Code block", block: ["```\n", "\n```"], className: "font-mono text-[11px]" },
];

export function PromptEditor({ q, onChange }: { q: Question; onChange: (fn: (q: Question) => Question) => void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState("");
  const [alt, setAlt] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [upload, setUpload] = useState<{ name: string; pct: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const media = q.media ?? [];

  /** Uploads a picture (shrunk first) or video straight to storage, with progress. */
  const uploadFile = async (picked: File) => {
    setUploadError(null);
    let file: Blob = picked;
    let type = picked.type;
    if (!UPLOAD.types[type]) return setUploadError("Upload a picture (PNG, JPG, GIF or WebP) or a video (MP4, WebM or MOV).");
    if (UPLOAD.types[type].kind === "image" && type !== "image/gif") {
      const small = await shrinkImage(picked).catch(() => null);
      if (small) {
        file = small;
        type = small.type;
      }
    }
    const kind = UPLOAD.types[type]?.kind;
    const max = kind === "image" ? UPLOAD.maxImageBytes : UPLOAD.maxVideoBytes;
    if (file.size > max) return setUploadError(`${kind === "image" ? "Pictures" : "Videos"} can be at most ${max / 1024 / 1024} MB.`);
    setUpload({ name: picked.name, pct: 0 });
    const res = await fetch("/api/live/media/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, size: file.size }) }).catch(() => null);
    const start = await res?.json().catch(() => null);
    if (!res?.ok) {
      setUpload(null);
      return setUploadError(start?.error ?? "Couldn't start the upload.");
    }
    const ok = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", start.uploadUrl);
      xhr.setRequestHeader("Content-Type", type);
      xhr.upload.onprogress = (e) => e.lengthComputable && setUpload({ name: picked.name, pct: Math.round((e.loaded / e.total) * 100) });
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
    setUpload(null);
    if (!ok) return setUploadError("The upload didn't finish. Check your connection and try again.");
    onChange((x) => ({ ...x, media: [...(x.media ?? []), { kind: "upload" as const, path: start.path, type: start.kind, alt: "" }].slice(0, MAX_MEDIA) }));
  };

  const setPrompt = (prompt: string) => onChange((x) => ({ ...x, prompt: prompt.slice(0, LIMITS.prompt) }));

  /** Applies a tool to the selection, keeping the cursor where you'd expect. */
  const apply = (t: Tool) => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const picked = value.slice(a, b);
    let next = value;
    let selA = a;
    let selB = b;
    if (t.wrap) {
      const text = picked || (t.label === "🔗" ? "link text" : "text");
      next = value.slice(0, a) + t.wrap[0] + text + t.wrap[1] + value.slice(b);
      selA = a + t.wrap[0].length;
      selB = selA + text.length;
    } else if (t.block) {
      const text = picked || "code";
      const before = a > 0 && value[a - 1] !== "\n" ? "\n" : "";
      next = value.slice(0, a) + before + t.block[0] + text + t.block[1] + value.slice(b);
      selA = a + before.length + t.block[0].length;
      selB = selA + text.length;
    } else if (t.line) {
      // Put the marker at the start of every selected line.
      const start = value.lastIndexOf("\n", a - 1) + 1;
      const chunk = value.slice(start, b);
      const marked = chunk
        .split("\n")
        .map((l, i) => (t.line === "1. " ? `${i + 1}. ` : t.line) + l.replace(/^(#{1,3}\s|[-*+]\s|\d+\.\s|>\s?)/, ""))
        .join("\n");
      next = value.slice(0, start) + marked + value.slice(b);
      selA = start + marked.length;
      selB = selA;
    }
    setPrompt(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selA, selB);
    });
  };

  const addMedia = async () => {
    const p = parseMediaLink(link, alt);
    if (!p.ok) return setLinkError(p.error);
    // Try a picture before adding it, so a link to a web page (not the picture itself) is caught now.
    if (p.media.kind === "image") {
      setChecking(true);
      const ok = await new Promise<boolean>((resolve) => {
        const img = new Image();
        img.referrerPolicy = "no-referrer";
        img.onload = () => resolve(img.naturalWidth > 0);
        img.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 8000);
        img.src = p.media.kind === "image" ? p.media.url : "";
      });
      setChecking(false);
      if (!ok) return setLinkError("That picture didn't load. Make sure it's a link to the picture itself (right-click the picture → Copy image address).");
    }
    onChange((x) => ({ ...x, media: [...(x.media ?? []), p.media].slice(0, MAX_MEDIA) }));
    setLink("");
    setAlt("");
    setLinkError(null);
    setAdding(false);
  };

  const btn = "flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm hover:bg-foreground/[.08] disabled:opacity-40";

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-xl border border-line focus-within:border-accent">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-foreground/[.03] p-1" role="toolbar" aria-label="Formatting">
          {TOOLS.map((t) => (
            <button key={t.title} type="button" title={t.title} aria-label={t.title} disabled={preview} onMouseDown={(e) => e.preventDefault()} onClick={() => apply(t)} className={btn}>
              <span className={t.className}>{t.label}</span>
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          <button type="button" title="Upload a picture or video from your device" disabled={media.length >= MAX_MEDIA || !!upload} onClick={() => fileRef.current?.click()} className={btn}>
            ⬆️ <span className="ml-1 text-xs">Upload</span>
          </button>
          <button type="button" title="Add a picture or video by link" disabled={media.length >= MAX_MEDIA} onClick={() => setAdding((v) => !v)} className={btn} aria-expanded={adding}>
            🔗 <span className="ml-1 text-xs">Picture / video link</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            hidden
            accept={Object.keys(UPLOAD.types).join(",")}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void uploadFile(f);
            }}
          />
          <button type="button" aria-pressed={preview} onClick={() => setPreview((v) => !v)} className={`${btn} ml-auto text-xs font-semibold ${preview ? "bg-accent text-on-accent hover:bg-accent" : ""}`}>
            {preview ? "✏️ Edit" : "👁 Preview"}
          </button>
        </div>
        {preview ? (
          <div className="min-h-[88px] bg-background p-4 text-center text-lg font-bold text-foreground">
            {q.prompt.trim() ? <Markdown text={q.prompt} /> : <p className="font-normal text-muted">Nothing to preview yet.</p>}
            <QuestionMediaView media={media} className="mt-3" />
          </div>
        ) : (
          <textarea
            ref={ref}
            value={q.prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (!(e.ctrlKey || e.metaKey)) return;
              const t = e.key === "b" ? TOOLS[0] : e.key === "i" ? TOOLS[1] : e.key === "k" ? TOOLS[5] : null;
              if (t) {
                e.preventDefault();
                apply(t);
              }
            }}
            placeholder={q.type === "html" ? "Question text (optional; your HTML can show it instead)" : "Type your question. Use the buttons above for **bold**, lists, links and more."}
            aria-label="Question"
            rows={3}
            className="block w-full resize-y bg-background px-3 py-2 text-base outline-none"
          />
        )}
      </div>
      <p className="text-right text-xs text-muted">
        {q.prompt.length}/{LIMITS.prompt}
      </p>

      {upload && (
        <div className="flex flex-col gap-1 rounded-xl border border-line p-3 text-sm" role="status">
          <span>
            Uploading <b>{upload.name}</b>… {upload.pct}%
          </span>
          <span className="h-2 overflow-hidden rounded-full bg-foreground/10">
            <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${upload.pct}%` }} />
          </span>
        </div>
      )}
      {uploadError && <p className="text-sm text-danger">{uploadError}</p>}

      {adding && (
        <div className="flex flex-col gap-2 rounded-xl border border-line bg-foreground/[.03] p-3">
          <p className="text-sm font-semibold">Add a picture or video</p>
          <p className="text-xs text-muted">Paste a YouTube or Vimeo link to embed the video, or a link to a picture (it has to start with https://).</p>
          <input
            value={link}
            autoFocus
            onChange={(e) => {
              setLink(e.target.value);
              setLinkError(null);
            }}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              void addMedia();
            }}
            placeholder="https://www.youtube.com/watch?v=… or https://…/picture.png"
            aria-label="Picture or video link"
            className={`${input} h-10`}
          />
          {!/youtu|vimeo/i.test(link) && link && (
            <input value={alt} onChange={(e) => setAlt(e.target.value)} placeholder="Describe the picture (for screen readers)" aria-label="Picture description" maxLength={120} className={`${input} h-10`} />
          )}
          {linkError && <p className="text-xs text-danger">{linkError}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => void addMedia()} disabled={!link.trim() || checking} className="h-9 rounded-full bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50">
              {checking ? "Checking…" : "Add"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="h-9 rounded-full px-3 text-sm text-muted hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {media.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {media.map((m, i) => (
            <li key={i} className="relative rounded-xl border border-line p-1.5">
              <QuestionMediaView media={[m]} />
              <button
                type="button"
                onClick={() => onChange((x) => ({ ...x, media: (x.media ?? []).filter((_, j) => j !== i) }))}
                aria-label="Remove"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm text-white hover:bg-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Pictures are shrunk to at most 1600px and saved as WebP (or JPEG), unless that would make them bigger. */
async function shrinkImage(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
  const blob = out?.type === "image/webp" ? out : await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
  return blob && blob.size < file.size ? blob : null;
}
