"use client";

import { useState } from "react";
import { percentRight, reportCsv, type GameReport } from "@/lib/live/report";
import { LiveAvatar } from "./LiveAvatar";
import { ANSWER_COLORS, ANSWER_SHAPES, secondary } from "./ui";

/**
 * A host's report: by question (each player's exact choice, how many picked
 * each option, % right) or by player (all their answers). Downloads as CSV.
 */
export function ReportView({ report }: { report: GameReport }) {
  const [tab, setTab] = useState<"questions" | "players">("questions");
  const [player, setPlayer] = useState(0);

  const download = () => {
    const blob = new Blob(["﻿" + reportCsv(report)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jace-live-${report.code}-${(report.setTitle ?? "report").replace(/[^\w-]+/g, "-").slice(0, 40)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (report.questions.length === 0) return <p className="text-sm text-muted">This game had no questions, so there are no answers to show.</p>;

  const overall = (() => {
    const tries = report.players.flatMap((p) => p.answers.flat());
    return tries.length ? Math.round((tries.filter((t) => t.correct).length / tries.length) * 100) : null;
  })();
  const p = report.players[player];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full border border-line bg-panel p-1 text-sm font-semibold" role="tablist">
          {(
            [
              ["questions", "By question"],
              ["players", "By player"],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-full px-4 py-1.5 ${tab === t ? "bg-accent text-on-accent" : "text-muted"}`}>
              {label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">
          {report.players.length} player{report.players.length === 1 ? "" : "s"} · {report.questions.length} questions
          {overall !== null && ` · ${overall}% right overall`}
        </span>
        <button type="button" onClick={download} className={`${secondary} ml-auto h-9`}>
          ⬇ Download CSV
        </button>
      </div>

      {tab === "questions" ? (
        <ol className="flex flex-col gap-3">
          {report.questions.map((q, i) => {
            const pct = percentRight(report, i);
            const tried = report.players.filter((pl) => (pl.answers[i] ?? []).length > 0);
            // How many tries picked each choice.
            const counts = q.choices?.map((c) => report.players.reduce((n, pl) => n + (pl.answers[i] ?? []).filter((a) => a.yours === c).length, 0));
            const total = counts?.reduce((a, b) => a + b, 0) ?? 0;
            return (
              <li key={i} className="rounded-2xl border border-line bg-panel p-4">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-sm text-muted">Q{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{q.prompt}</p>
                    <p className="text-sm text-muted">
                      Right answer: <b className="text-green-600 dark:text-green-400">{q.right || "—"}</b>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${pct === null ? "bg-foreground/[.06] text-muted" : pct >= 70 ? "bg-green-500/15 text-green-600 dark:text-green-400" : pct >= 40 ? "bg-amber-500/15 text-amber-600 dark:text-amber-400" : "bg-red-500/15 text-red-600 dark:text-red-400"}`}
                  >
                    {pct === null ? "no answers" : `${pct}% right`}
                  </span>
                </div>
                {q.choices && counts && total > 0 && (
                  <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                    {q.choices.map((c, ci) => {
                      const right = q.right.split(" / ").includes(c);
                      return (
                        <div key={ci} className="relative overflow-hidden rounded-lg bg-foreground/[.04] px-3 py-1.5 text-sm">
                          <span className="absolute inset-y-0 left-0 opacity-25" style={{ width: `${(counts[ci] / total) * 100}%`, background: ANSWER_COLORS[ci % 4] }} />
                          <span className="relative flex items-center gap-2">
                            <span style={{ color: ANSWER_COLORS[ci % 4] }}>{ANSWER_SHAPES[ci % 4]}</span>
                            <span className="flex-1 truncate">
                              {c} {right && "✅"}
                            </span>
                            <b className="tabular-nums">{counts[ci]}</b>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {report.players.map((pl, pi) => {
                    const tries = pl.answers[i] ?? [];
                    if (tries.length === 0) return null;
                    return (
                      <li key={pi} className="flex items-center gap-1.5 rounded-full bg-foreground/[.05] py-1 pl-1 pr-3 text-xs">
                        <LiveAvatar avatar={pl.avatar} size={20} />
                        <span className="font-semibold">{pl.name}:</span>
                        {tries.map((t, ti) => (
                          <span key={ti} className={t.correct ? "text-green-600 dark:text-green-400" : "text-red-600 line-through dark:text-red-400"}>
                            {t.correct ? "✓" : "✗"} {t.yours}
                          </span>
                        ))}
                      </li>
                    );
                  })}
                  {tried.length < report.players.length && (
                    <li className="px-1 py-1 text-xs text-muted">
                      {report.players.length - tried.length} didn&apos;t answer
                    </li>
                  )}
                </ul>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            {report.players.map((pl, pi) => (
              <button
                key={pi}
                type="button"
                aria-pressed={player === pi}
                onClick={() => setPlayer(pi)}
                className={`flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm ${player === pi ? "border-accent bg-accent/10 font-semibold" : "border-line"}`}
              >
                <LiveAvatar avatar={pl.avatar} size={22} />
                {pl.name}
              </button>
            ))}
          </div>
          {p && (
            <div className="rounded-2xl border border-line bg-panel p-4">
              <p className="font-semibold">
                {p.name}: {p.correct} right of {p.answered} answered
                {p.answered > 0 && ` (${Math.round((p.correct / p.answered) * 100)}%)`}
              </p>
              <ol className="mt-3 flex flex-col gap-2">
                {report.questions.map((q, i) => {
                  const tries = p.answers[i] ?? [];
                  return (
                    <li key={i} className={`rounded-xl border-l-4 p-3 text-sm ${tries.length === 0 ? "border-line" : tries.every((t) => t.correct) ? "border-green-500 bg-green-500/[.07]" : "border-red-500 bg-red-500/[.07]"}`}>
                      <p className="font-semibold">
                        Q{i + 1}. {q.prompt}
                      </p>
                      {tries.length === 0 ? (
                        <p className="text-muted">Didn&apos;t answer</p>
                      ) : (
                        tries.map((t, ti) => (
                          <p key={ti}>
                            {t.correct ? "✅" : "❌"} {t.yours}
                          </p>
                        ))
                      )}
                      {tries.some((t) => !t.correct) && (
                        <p className="text-muted">
                          Right answer: <b className="text-green-600 dark:text-green-400">{q.right}</b>
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
