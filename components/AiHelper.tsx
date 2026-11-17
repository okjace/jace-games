"use client";

import { useState } from "react";

/**
 * The AI helper's two steps: copy a prompt into any AI u already use (free),
 * then paste its answer back. Nothing is sent anywhere by Jace Live.
 */
export function CopyPaste({ prompt, onPaste, pasteLabel, disabled = false }: { prompt: string; onPaste: (text: string) => string | null; pasteLabel: string; disabled?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg({ ok: false, text: "couldnt copy. select the prompt text n copy it urself." });
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">1. copy this prompt into any AI (ChatGPT, Claude, Gemini… free ones work)</p>
        <textarea readOnly value={prompt} rows={5} aria-label="Prompt to copy" className="w-full rounded-xl border border-line bg-background/60 p-2 font-mono text-[11px] text-muted" onFocus={(e) => e.currentTarget.select()} />
        <button type="button" onClick={() => void copy()} disabled={disabled} className="self-start rounded-full bg-accent px-4 py-2 text-sm font-bold text-on-accent disabled:opacity-50">
          {copied ? "✅ copied!" : "📋 copy prompt"}
        </button>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-semibold">2. paste what the AI wrote back here</p>
        <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} placeholder="paste the AI's whole answer…" aria-label="The AI's answer" className="w-full rounded-xl border border-line bg-background/60 p-2 font-mono text-xs outline-none focus:border-accent" />
        <button
          type="button"
          disabled={!answer.trim()}
          onClick={() => {
            const err = onPaste(answer);
            if (err) setMsg({ ok: false, text: err });
            else {
              setMsg({ ok: true, text: "done!! 🎉 it's marked as made with AI." });
              setAnswer("");
            }
          }}
          className="self-start rounded-full border border-line px-4 py-2 text-sm font-bold hover:bg-accent/10 disabled:opacity-50"
        >
          {pasteLabel}
        </button>
      </div>
      {msg && <p className={`text-sm font-semibold ${msg.ok ? "" : "text-danger"}`}>{msg.text}</p>}
      <p className="text-xs text-muted">AI can make mistakes: check it before u share it. stuff made this way always shows a 🤖 made with AI label.</p>
    </div>
  );
}

/** The "made with AI" switch for a game or set: locked on when the AI helper made it. */
export function MadeWithAi({ value, onChange }: { value: "helper" | "self" | null | undefined; onChange: (v: "self" | null) => void }) {
  const locked = value === "helper";
  return (
    <label className={`flex items-start gap-2 text-sm ${locked ? "opacity-80" : ""}`}>
      <input type="checkbox" checked={!!value} disabled={locked} onChange={(e) => onChange(e.target.checked ? "self" : null)} className="mt-0.5" />
      <span>
        <span className="font-medium">🤖 made with AI</span>
        <span className="block text-xs text-muted">
          {locked ? "on for good: the AI helper was used for this." : "turn this on if an AI (any one) helped make this. it shows a label so ppl know."}
        </span>
      </span>
    </label>
  );
}

/** The 🤖 made with AI label (with the disclaimer on hover / for screen readers). */
export function AiBadge({ ai, className = "" }: { ai: "helper" | "self" | null | undefined; className?: string }) {
  if (!ai) return null;
  return (
    <span
      title="Made with AI. It might have mistakes."
      aria-label="Made with AI. It might have mistakes."
      className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-bold text-violet-700 dark:text-violet-300 ${className}`}
    >
      🤖 made with AI
    </span>
  );
}

/** The longer disclaimer, for pages where someone plays or reads the thing. */
export function AiNotice({ ai, what }: { ai: "helper" | "self" | null | undefined; what: "game" | "set" }) {
  if (!ai) return null;
  return (
    <p role="note" className="rounded-xl border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-xs">
      🤖 this {what} was made with AI. AI can make mistakes{what === "set" ? ", so double-check the answers" : ""}.
    </p>
  );
}
