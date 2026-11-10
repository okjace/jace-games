"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LIMITS, isPlayable, type LiveSet, type Question, type QuestionType } from "@/lib/live/types";
import { plainText } from "@/lib/live/media";
import { HTML_TEMPLATE, HtmlFrame } from "./HtmlFrame";
import { ImportQuestions } from "./ImportQuestions";
import { PromptEditor } from "./PromptEditor";
import { ANSWER_COLORS, ANSWER_SHAPES, card, input, primary, secondary } from "./ui";

const TIMES = [5, 10, 20, 30, 60, 90, 120];
const TYPES: { id: QuestionType; label: string }[] = [
  { id: "choice", label: "Multiple choice" },
  { id: "truefalse", label: "True or false" },
  { id: "type", label: "Type the answer" },
  { id: "html", label: "Custom HTML" },
];

const newId = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function blank(type: QuestionType = "choice"): Question {
  const base = { id: newId(), type, prompt: "", time: 20, points: 1 as const };
  if (type === "choice") return { ...base, choices: ["", "", "", ""], correct: [] };
  if (type === "truefalse") return { ...base, choices: ["True", "False"], correct: [] };
  if (type === "html") return { ...base, html: HTML_TEMPLATE, accepted: ["42"], time: 30 };
  return { ...base, accepted: [] };
}

/** Switching type keeps the prompt, time and points and resets the rest. */
function retype(q: Question, type: QuestionType): Question {
  const fresh = blank(type);
  return { ...fresh, id: q.id, prompt: q.prompt, time: q.time, points: q.points, ...(q.media ? { media: q.media } : {}), ...(q.html && type !== "html" ? { html: q.html } : {}) };
}

export function SetEditor({ id }: { id: string }) {
  const router = useRouter();
  const [set, setSet] = useState<LiveSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    fetch(`/api/live/sets/${id}`, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load this set.");
        if (!d.mine) throw new Error("You can only edit your own sets.");
        setSet(d.set);
        if (d.set.questions.length) setOpen(d.set.questions[0].id);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const save = useCallback(
    async (s: LiveSet) => {
      setStatus("saving");
      const res = await fetch(`/api/live/sets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: s.title,
          description: s.description,
          cover: s.cover,
          tags: s.tags,
          visibility: s.visibility,
          questions: s.questions,
        }),
      }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (res?.ok) {
        dirty.current = false;
        setStatus("saved");
        setSaveError(null);
      } else {
        setStatus("error");
        setSaveError(body?.error ?? "Couldn't save. Check your connection.");
      }
    },
    [id],
  );

  // Save a moment after the last change.
  useEffect(() => {
    if (!set || !dirty.current) return;
    const t = setTimeout(() => void save(set), 1200);
    return () => clearTimeout(t);
  }, [set, save]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  if (error) return <p className={`${card} text-center text-sm text-muted`}>{error}</p>;
  if (!set) return <div className="h-64 animate-pulse rounded-2xl bg-foreground/[.04]" />;

  const update = (patch: Partial<LiveSet>) => {
    dirty.current = true;
    setStatus("unsaved");
    setSet({ ...set, ...patch });
  };
  const setQ = (qid: string, fn: (q: Question) => Question) => update({ questions: set.questions.map((q) => (q.id === qid ? fn(q) : q)) });
  const move = (i: number, d: number) => {
    const qs = [...set.questions];
    const j = i + d;
    if (j < 0 || j >= qs.length) return;
    [qs[i], qs[j]] = [qs[j], qs[i]];
    update({ questions: qs });
  };
  const playable = set.questions.filter(isPlayable).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/live" aria-label="Back to Live" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:bg-foreground/[.06] hover:text-foreground">
            ←
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Edit set</h1>
          <span className={`text-xs ${status === "error" ? "text-danger" : "text-muted"}`} aria-live="polite">
            {status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved changes" : status === "error" ? saveError : "All changes saved"}
          </span>
        </div>
        <div className="flex gap-2">
          <Link href={`/live/sets/${id}`} className={secondary}>
            Preview
          </Link>
          <button type="button" disabled={playable === 0} onClick={() => router.push(`/live/host/new?set=${id}`)} className={primary} title={playable === 0 ? "Finish a question first" : undefined}>
            Host
          </button>
        </div>
      </div>

      <section className={`${card} grid gap-3 sm:grid-cols-[80px_minmax(0,1fr)]`}>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Cover
          <input value={set.cover} onChange={(e) => update({ cover: e.target.value })} aria-label="Cover emoji" className={`${input} h-16 text-center text-3xl`} />
        </label>
        <div className="flex flex-col gap-3">
          <input value={set.title} onChange={(e) => update({ title: e.target.value.slice(0, 80) })} placeholder="Set title" aria-label="Title" className={`${input} text-lg font-semibold`} />
          <textarea
            value={set.description}
            onChange={(e) => update({ description: e.target.value.slice(0, 400) })}
            placeholder="What's this set about?"
            aria-label="Description"
            rows={2}
            className={`${input} h-auto py-2`}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              defaultValue={set.tags.join(", ")}
              onBlur={(e) => update({ tags: e.target.value.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 6) })}
              placeholder="Tags, separated by commas"
              aria-label="Tags"
              className={input}
            />
            <select value={set.visibility} onChange={(e) => update({ visibility: e.target.value as LiveSet["visibility"] })} aria-label="Who can see it" className={input}>
              <option value="private">Private: only you</option>
              <option value="unlisted">Unlisted: anyone with the link</option>
              <option value="public">Public: listed in Discover</option>
            </select>
          </div>
        </div>
      </section>

      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">
          Questions <span className="text-sm font-normal text-muted">{playable}/{set.questions.length} ready</span>
        </h2>
      </div>

      <ol className="flex flex-col gap-3">
        {set.questions.map((q, i) => {
          const ready = isPlayable(q);
          const expanded = open === q.id;
          return (
            <li key={q.id} className={`${card} ${ready ? "" : "border-warn/50"}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setOpen(expanded ? null : q.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={expanded}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[.06] text-sm font-semibold">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                  {plainText(q.prompt) || (q.media?.length ? "🖼️ Picture question" : q.type === "html" ? "Custom HTML question" : <span className="text-muted">New question</span>)}
                </span>
                  {!ready && <span className="shrink-0 text-xs text-warn">Not finished</span>}
                </button>
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up" className="h-8 w-8 rounded-full text-muted hover:bg-foreground/[.06] disabled:opacity-30">
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === set.questions.length - 1} aria-label="Move down" className="h-8 w-8 rounded-full text-muted hover:bg-foreground/[.06] disabled:opacity-30">
                  ↓
                </button>
              </div>
              {expanded && (
                <QuestionForm
                  q={q}
                  onChange={(fn) => setQ(q.id, fn)}
                  onDuplicate={() => {
                    const copy = { ...q, id: newId() };
                    const qs = [...set.questions];
                    qs.splice(i + 1, 0, copy);
                    update({ questions: qs });
                    setOpen(copy.id);
                  }}
                  onDelete={() => update({ questions: set.questions.filter((x) => x.id !== q.id) })}
                />
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap gap-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={set.questions.length >= 100}
            onClick={() => {
              const q = blank(t.id);
              update({ questions: [...set.questions, q] });
              setOpen(q.id);
            }}
            className={secondary}
          >
            + {t.label}
          </button>
        ))}
        <button type="button" disabled={set.questions.length >= LIMITS.questions} onClick={() => setImporting(true)} className={secondary}>
          ⬆️ Import
        </button>
      </div>
      {importing && (
        <ImportQuestions
          room={LIMITS.questions - set.questions.length}
          onClose={() => setImporting(false)}
          onImport={(qs) => {
            update({ questions: [...set.questions, ...qs].slice(0, LIMITS.questions) });
            setImporting(false);
            if (qs[0]) setOpen(qs[0].id);
          }}
        />
      )}

      <div className="mt-6 border-t border-line pt-4">
        <button
          type="button"
          onClick={async () => {
            if (!confirm("Delete this set? This can't be undone.")) return;
            const res = await fetch(`/api/live/sets/${id}`, { method: "DELETE" });
            if (res.ok) {
              dirty.current = false;
              router.push("/live");
            }
          }}
          className="text-sm text-danger hover:underline"
        >
          Delete set
        </button>
      </div>
    </div>
  );
}

function QuestionForm({
  q,
  onChange,
  onDuplicate,
  onDelete,
}: {
  q: Question;
  onChange: (fn: (q: Question) => Question) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [tried, setTried] = useState<string | null>(null);
  const toggleCorrect = (j: number) =>
    onChange((x) => {
      const cur = x.correct ?? [];
      if (x.type === "truefalse") return { ...x, correct: [j] };
      return { ...x, correct: cur.includes(j) ? cur.filter((n) => n !== j) : [...cur, j] };
    });

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <select value={q.type} onChange={(e) => onChange((x) => retype(x, e.target.value as QuestionType))} aria-label="Question type" className={input}>
          {TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select value={q.time} onChange={(e) => onChange((x) => ({ ...x, time: Number(e.target.value) }))} aria-label="Time limit" className={input}>
          {TIMES.map((t) => (
            <option key={t} value={t}>
              {t} seconds
            </option>
          ))}
        </select>
        <select value={q.points} onChange={(e) => onChange((x) => ({ ...x, points: Number(e.target.value) as 0 | 1 | 2 }))} aria-label="Points" className={input}>
          <option value={1}>Normal points</option>
          <option value={2}>Double points</option>
          <option value={0}>No points (poll)</option>
        </select>
      </div>

      <PromptEditor q={q} onChange={onChange} />

      {q.type === "choice" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(q.choices ?? []).map((c, j) => (
            <div key={j} className="flex items-center gap-2 rounded-xl p-2" style={{ background: `${ANSWER_COLORS[j]}26` }}>
              <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: ANSWER_COLORS[j] }}>
                {ANSWER_SHAPES[j]}
              </span>
              <input
                value={c}
                onChange={(e) => onChange((x) => ({ ...x, choices: x.choices!.map((y, k) => (k === j ? e.target.value.slice(0, 120) : y)) }))}
                placeholder={j < 2 ? `Answer ${j + 1}` : `Answer ${j + 1} (optional)`}
                aria-label={`Answer ${j + 1}`}
                className={`${input} h-9`}
              />
              <label className="flex shrink-0 items-center gap-1 text-xs">
                <input type="checkbox" checked={(q.correct ?? []).includes(j)} onChange={() => toggleCorrect(j)} />
                Right
              </label>
            </div>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            {(q.choices ?? []).length > 2 && (
              <button
                type="button"
                className="text-xs text-muted hover:text-foreground"
                onClick={() =>
                  onChange((x) => ({ ...x, choices: x.choices!.slice(0, -1), correct: (x.correct ?? []).filter((n) => n < x.choices!.length - 1) }))
                }
              >
                − Remove last answer
              </button>
            )}
            {(q.choices ?? []).length < 4 && (
              <button type="button" className="text-xs text-muted hover:text-foreground" onClick={() => onChange((x) => ({ ...x, choices: [...x.choices!, ""] }))}>
                + Add an answer
              </button>
            )}
          </div>
        </div>
      )}

      {q.type === "truefalse" && (
        <div className="flex gap-2">
          {["True", "False"].map((label, j) => (
            <button
              key={label}
              type="button"
              aria-pressed={(q.correct ?? []).includes(j)}
              onClick={() => toggleCorrect(j)}
              className={`h-12 flex-1 rounded-xl text-sm font-semibold text-white ${(q.correct ?? []).includes(j) ? "ring-4 ring-accent" : "opacity-70"}`}
              style={{ background: ANSWER_COLORS[j] }}
            >
              {label} {(q.correct ?? []).includes(j) && "✓"}
            </button>
          ))}
        </div>
      )}

      {(q.type === "type" || q.type === "html") && (
        <label className="flex flex-col gap-1 text-sm">
          Accepted answers <span className="text-xs text-muted">One per line. Case, extra spaces and end punctuation don&apos;t matter.</span>
          <textarea
            value={(q.accepted ?? []).join("\n")}
            onChange={(e) => onChange((x) => ({ ...x, accepted: e.target.value.split("\n").slice(0, 10) }))}
            rows={3}
            className={`${input} h-auto py-2 font-mono`}
          />
        </label>
      )}

      {q.type === "html" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            Your HTML
            <span className="text-xs text-muted">
              Runs sandboxed with no internet access. Call <code>jace.answer(value)</code> to answer; <code>jace.onLock(fn)</code> runs when time&apos;s up.
            </span>
            <textarea
              value={q.html ?? ""}
              onChange={(e) => onChange((x) => ({ ...x, html: e.target.value.slice(0, 64 * 1024) }))}
              rows={14}
              spellCheck={false}
              className={`${input} h-auto py-2 font-mono text-xs`}
            />
          </label>
          <div className="flex flex-col gap-1 text-sm">
            Preview
            <HtmlFrame html={q.html ?? ""} title="Question preview" onAnswer={setTried} height={300} />
            {tried !== null && (
              <p className="text-xs">
                It answered <code className="rounded bg-foreground/[.08] px-1">{tried}</code>:{" "}
                {(q.accepted ?? []).some((a) => a.trim().toLowerCase() === tried.trim().toLowerCase()) ? (
                  <span className="text-accent">accepted ✓</span>
                ) : (
                  <span className="text-danger">not accepted</span>
                )}
              </p>
            )}
          </div>
        </div>
      ) : (
        <details className="text-sm" open={!!q.html}>
          <summary className="cursor-pointer text-muted">Add custom HTML to the question (pictures, diagrams, anything)</summary>
          <div className="mt-2 grid gap-3 lg:grid-cols-2">
            <textarea
              value={q.html ?? ""}
              onChange={(e) => onChange((x) => ({ ...x, html: e.target.value.slice(0, 64 * 1024) || undefined }))}
              rows={8}
              spellCheck={false}
              placeholder={'<svg width="200" height="100">…</svg>'}
              className={`${input} h-auto py-2 font-mono text-xs`}
            />
            {q.html && <HtmlFrame html={q.html} title="HTML preview" height={200} />}
          </div>
        </details>
      )}

      <div className="flex gap-3 border-t border-line pt-3 text-sm">
        <button type="button" onClick={onDuplicate} className="text-muted hover:text-foreground">
          Duplicate
        </button>
        <button type="button" onClick={onDelete} className="text-danger hover:underline">
          Delete question
        </button>
      </div>
    </div>
  );
}
