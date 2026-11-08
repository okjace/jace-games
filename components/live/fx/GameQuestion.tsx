"use client";

import { useEffect, useState } from "react";
import type { PlayerQuestion } from "@/lib/live/types";
import { HtmlFrame } from "../HtmlFrame";
import { Markdown, QuestionMediaView } from "../Markdown";
import { useJuice } from "./Juice";
import { sfx } from "./sfx";

/**
 * The answer screen for self-paced modes: a question card, big answer
 * tiles, and instant feedback (sound, flash, haptics) before moving on.
 * `onAnswer` sends the answer and resolves with whether it was right.
 */

export type AnswerResult = { correct: boolean; right?: string[] } | null;

const TILE = [
  { bg: "linear-gradient(160deg,#ff5f6d,#d7263d)", shape: "▲" },
  { bg: "linear-gradient(160deg,#4facfe,#1f63d6)", shape: "◆" },
  { bg: "linear-gradient(160deg,#ffd166,#e09200)", shape: "●" },
  { bg: "linear-gradient(160deg,#4ade80,#16a34a)", shape: "■" },
];

export function GameQuestion({
  q,
  streak,
  onAnswer,
  accent = "#3ddc84",
}: {
  q: PlayerQuestion;
  streak: number;
  onAnswer: (a: number | string) => Promise<AnswerResult>;
  accent?: string;
}) {
  const juice = useJuice();
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // A fresh question resets the card.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPicked(null);
    setResult(null);
    setText("");
    setSending(false);
  }, [q.id, q.prompt]);

  const send = async (a: number | string, tile: number | null) => {
    if (sending || result) return;
    setSending(true);
    setPicked(tile);
    const r = await onAnswer(a);
    setSending(false);
    if (!r) return setPicked(null);
    setResult(r);
    if (r.correct) {
      sfx.correct();
      juice.flash("rgba(61,220,132,0.35)");
      if (streak + 1 >= 3) sfx.streak(streak + 1);
    } else {
      sfx.wrong();
      juice.flash("rgba(229,72,77,0.35)");
      juice.shake();
    }
  };

  const rightChoice = (i: number) => result && !result.correct && result.right?.includes((q.choices ?? [])[i]);

  return (
    <div className="flex flex-col gap-3" style={{ animation: "jg-rise 0.25s ease-out" }}>
      <div className="relative rounded-3xl bg-white p-5 text-center text-neutral-900 shadow-[0_6px_0_rgba(0,0,0,0.18)]">
        {streak >= 2 && (
          <span className="absolute -top-3 right-4 rounded-full px-3 py-1 text-sm font-black text-white shadow" style={{ background: "linear-gradient(90deg,#ff7a18,#ff3d00)" }}>
            🔥 {streak} streak
          </span>
        )}
        {q.prompt ? (
          <Markdown text={q.prompt} className="text-xl font-extrabold leading-snug sm:text-2xl" />
        ) : (
          <p className="text-xl font-extrabold leading-snug sm:text-2xl">{q.type === "html" ? "Answer below" : ""}</p>
        )}
        <QuestionMediaView media={q.media} className="mt-3" />
        {q.html && (
          <div className="mt-3">
            <HtmlFrame html={q.html} title="Question" height={q.type === "html" ? 320 : 200} locked={!!result} onAnswer={q.type === "html" ? (v) => void send(v, null) : undefined} />
          </div>
        )}
      </div>

      {(q.type === "choice" || q.type === "truefalse") && (
        <div className="grid grid-cols-2 gap-3">
          {(q.choices ?? []).map((c, i) => {
            const mine = picked === i;
            const dim = result && !mine && !rightChoice(i);
            return (
              <button
                key={i}
                type="button"
                disabled={sending || !!result}
                onClick={() => {
                  sfx.tap();
                  void send(i, i);
                }}
                className={`relative flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl p-3 text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] transition-all duration-150 active:translate-y-1 active:shadow-[0_2px_0_rgba(0,0,0,0.25)] sm:min-h-32 ${dim ? "scale-95 opacity-40" : ""} ${mine && sending ? "animate-pulse" : ""}`}
                style={{ background: TILE[i].bg }}
              >
                <span aria-hidden="true" className="text-3xl drop-shadow">
                  {TILE[i].shape}
                </span>
                <Markdown inline text={c} className="text-base font-extrabold leading-tight drop-shadow sm:text-lg" />
                {result && mine && (
                  <span className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl shadow-lg animate-pop">{result.correct ? "✅" : "❌"}</span>
                )}
                {rightChoice(i) && <span className="absolute -right-2 -top-2 flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl shadow-lg animate-pop">✅</span>}
              </button>
            );
          })}
        </div>
      )}

      {q.type === "type" && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) void send(text.trim(), null);
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 120))}
            placeholder="Type your answer"
            aria-label="Your answer"
            disabled={sending || !!result}
            autoFocus
            className="h-16 rounded-2xl border-4 border-white/70 bg-white px-4 text-center text-2xl font-bold text-neutral-900 outline-none focus:border-white"
          />
          <button type="submit" disabled={sending || !!result || !text.trim()} className="h-14 rounded-2xl text-xl font-black text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-1 disabled:opacity-60" style={{ background: accent }}>
            Submit
          </button>
        </form>
      )}

      {result && !result.correct && result.right && result.right.length > 0 && (q.type === "type" || q.type === "html") && (
        <p className="rounded-2xl bg-black/30 px-4 py-2 text-center font-bold text-white">It was: {result.right.join(" / ")}</p>
      )}
    </div>
  );
}
