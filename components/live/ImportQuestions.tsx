"use client";

import { useState } from "react";
import { CSV_TEMPLATE, importQuestions, type ImportResult } from "@/lib/live/importSets";
import { LIMITS, type Question } from "@/lib/live/types";
import { card, primary, secondary } from "./ui";

/**
 * Import questions into a set: upload a CSV (or paste one). Works with
 * Blooket's CSV import template, Kahoot's spreadsheet template saved as
 * CSV, Gimkit's CSV, our own CSV, and term/definition lists.
 */
export function ImportQuestions({ room, onImport, onClose }: { room: number; onImport: (qs: Question[]) => void; onClose: () => void }) {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const read = (t: string) => {
    setText(t);
    setResult(t.trim() ? importQuestions(t) : null);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "jace-games-questions-template.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const fits = result ? result.questions.slice(0, room) : [];

  return (
    <section className={`${card} flex flex-col gap-3 border-accent/40`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">⬆️ Import questions</h2>
          <p className="text-sm text-muted">Upload a CSV file or paste one below.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-foreground">
          ✕
        </button>
      </div>

      <details className="rounded-xl bg-foreground/[.04] p-3 text-sm">
        <summary className="cursor-pointer font-medium">Where do I get a file? (Blooket, Kahoot, Gimkit…)</summary>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-muted">
          <li>
            <b className="text-foreground">Blooket:</b> fill in Blooket&apos;s CSV import template (or a set you made with it) and upload the .csv here.
          </li>
          <li>
            <b className="text-foreground">Kahoot:</b> use Kahoot&apos;s spreadsheet import template, then in your spreadsheet app choose <i>File → Download / Save as → CSV</i>.
          </li>
          <li>
            <b className="text-foreground">Gimkit:</b> use a kit spreadsheet with the columns <i>Question, Correct Answer, Incorrect Answer 1–3</i>, saved as CSV.
          </li>
          <li>
            <b className="text-foreground">Flashcards:</b> paste <i>term, definition</i> pairs (one per line, comma or tab between). They become multiple choice.
          </li>
          <li>
            <b className="text-foreground">Make your own:</b>{" "}
            <button type="button" onClick={download} className="text-accent underline">
              download our template
            </button>{" "}
            and fill it in with any spreadsheet app.
          </li>
        </ul>
      </details>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Upload a file</span>
        <input
          type="file"
          accept=".csv,.tsv,.txt,text/csv,text/plain"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) read(await f.text());
          }}
          className="text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">…or paste it</span>
        <textarea
          value={text}
          onChange={(e) => read(e.target.value)}
          rows={5}
          placeholder={"Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct,Time\nWhat is 2 + 2?,3,4,5,6,2,20"}
          className="rounded-xl border border-line bg-background p-3 font-mono text-xs outline-none focus:border-accent"
        />
      </label>

      {result && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3 text-sm">
          <p>
            Read as <b>{result.format}</b>: <b>{result.questions.length}</b> question{result.questions.length === 1 ? "" : "s"} found
            {result.questions.length > room && ` (room for ${room} more in this set)`}.
          </p>
          {result.skipped.length > 0 && (
            <details>
              <summary className="cursor-pointer text-warn">{result.skipped.length} row(s) skipped</summary>
              <ul className="mt-1 list-disc pl-5 text-xs text-muted">
                {result.skipped.slice(0, 20).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </details>
          )}
          {fits.length > 0 && (
            <ol className="max-h-56 list-decimal overflow-y-auto pl-5 text-xs text-muted">
              {fits.map((q) => (
                <li key={q.id}>
                  <span className="text-foreground">{q.prompt}</span>{" "}
                  {q.type === "type" ? `→ ${(q.accepted ?? []).join(" / ")}` : `→ ${(q.correct ?? []).map((i) => q.choices?.[i]).join(" & ")}`}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" disabled={fits.length === 0} onClick={() => onImport(fits)} className={primary}>
          Add {fits.length || ""} question{fits.length === 1 ? "" : "s"}
        </button>
        <button type="button" onClick={onClose} className={secondary}>
          Cancel
        </button>
      </div>
      <p className="text-xs text-muted">A set can have up to {LIMITS.questions} questions. You can edit everything after importing.</p>
    </section>
  );
}
