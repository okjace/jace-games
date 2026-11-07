"use client";

import { useState } from "react";
import type { PlayerQuestion } from "@/lib/live/types";
import { HtmlFrame } from "./HtmlFrame";
import { ANSWER_COLORS, ANSWER_SHAPES, input, primary } from "./ui";

/** Answer buttons/inputs for a question, used by every mode. */
export function Answer({ q, disabled, onAnswer }: { q: PlayerQuestion; disabled: boolean; onAnswer: (a: number | string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3">
      {q.prompt && <p className="text-center text-xl font-bold">{q.prompt}</p>}
      {q.html && <HtmlFrame html={q.html} title="Question" height={q.type === "html" ? 340 : 220} locked={disabled} onAnswer={q.type === "html" ? (v) => onAnswer(v) : undefined} />}
      {(q.type === "choice" || q.type === "truefalse") && (
        <div className="grid grid-cols-2 gap-3">
          {(q.choices ?? []).map((c, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(i)}
              className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl p-3 text-lg font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
              style={{ background: ANSWER_COLORS[i] }}
            >
              <span aria-hidden="true" className="text-2xl">
                {ANSWER_SHAPES[i]}
              </span>
              <span className="text-sm sm:text-base">{c}</span>
            </button>
          ))}
        </div>
      )}
      {q.type === "type" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onAnswer(text.trim());
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} placeholder="Type your answer" aria-label="Your answer" disabled={disabled} autoFocus className={`${input} h-12 text-lg`} />
          <button type="submit" disabled={disabled || !text.trim()} className={primary}>
            Send
          </button>
        </form>
      )}
      {q.type === "html" && <p className="text-center text-xs text-muted">Answer in the box above.</p>}
    </div>
  );
}

