"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { LiveSet, PlayerQuestion } from "@/lib/live/types";
import { Markdown, QuestionMediaView } from "./Markdown";
import { ANSWER_COLORS, ANSWER_SHAPES, card, primary, secondary } from "./ui";

const TYPE_LABEL = { choice: "Multiple choice", truefalse: "True or false", type: "Type the answer", html: "Custom HTML" };

/** A set's page: its questions (without answers, unless it's yours) and a Host button. */
export function SetView({ id }: { id: string }) {
  const [data, setData] = useState<{ set: Omit<LiveSet, "questions"> & { questions: PlayerQuestion[] }; mine: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/live/sets/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load this set.");
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className={`${card} text-center text-sm text-muted`}>{error}</p>;
  if (!data) return <div className="h-64 animate-pulse rounded-2xl bg-foreground/[.04]" />;
  const { set, mine } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span aria-hidden="true" className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-foreground/[.05] text-4xl">
            {set.cover}
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{set.title}</h1>
            <p className="text-sm text-muted">
              by {set.owner_name} · {set.questions.length} questions · played {set.plays} time{set.plays === 1 ? "" : "s"}
            </p>
            {set.description && <p className="mt-2 max-w-2xl text-sm">{set.description}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {set.tags.map((t) => (
                <Link key={t} href={`/live/discover`} className="rounded-full bg-foreground/[.06] px-2 py-0.5 text-xs text-muted">
                  #{t}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {mine && (
            <Link href={`/live/sets/${id}/edit`} className={secondary}>
              Edit
            </Link>
          )}
          <Link href={`/live/host/new?set=${id}&solo=1`} className={secondary}>
            🎮 Play solo
          </Link>
          <Link href={`/live/host/new?set=${id}`} className={primary}>
            Host this set
          </Link>
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {set.questions.map((q, i) => (
          <li key={q.id} className={card}>
            <p className="text-xs text-muted">
              {i + 1}. {TYPE_LABEL[q.type]} · {q.time}s{q.points === 2 ? " · double points" : q.points === 0 ? " · no points" : ""}
            </p>
            {q.prompt ? <Markdown text={q.prompt} className="mt-1 font-medium" /> : <p className="mt-1 font-medium">{q.html ? "Custom HTML question" : ""}</p>}
            <QuestionMediaView media={q.media} className="mt-2 max-w-md" />
            {q.choices && q.type === "choice" && (
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {q.choices.map((c, j) => (
                  <li key={j} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-white" style={{ background: ANSWER_COLORS[j] }}>
                    <span aria-hidden="true">{ANSWER_SHAPES[j]}</span>
                    <Markdown inline text={c} />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
