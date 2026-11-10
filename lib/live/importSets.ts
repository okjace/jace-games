import { LIMITS, type Question } from "./types";

/**
 * Importing questions from a CSV file or pasted text. Recognizes:
 * - Blooket's CSV import template (Question Text, Answer 1–4, Time Limit, Correct Answer(s) as numbers)
 * - Kahoot's spreadsheet template saved as CSV (Question, Answer 1–4, Time limit, Correct answer(s) as numbers)
 * - Gimkit's CSV (Question, Correct Answer, Incorrect Answer 1–3)
 * - Jace Games' own CSV (Question, Answer 1–4, Correct, Time; or Question, Answer for typed answers)
 * - Two columns (term, definition), like a flashcard export: multiple choice using the other definitions
 * The header row can be anywhere in the first few rows (templates often have a title above it).
 */

export type ImportResult = { format: string; questions: Question[]; skipped: string[] };

const newId = (i: number) => `imp${Date.now().toString(36)}${i.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const TIMES = [5, 10, 20, 30, 60, 90, 120];

/** Splits CSV (or tab-separated) text into rows, handling quotes, "" escapes and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : (firstLine.split(";").length > firstLine.split(",").length ? ";" : ",");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clip = (s: string, n: number) => s.slice(0, n);
const nearestTime = (raw: string) => {
  const n = Number(raw.replace(/[^\d.]/g, ""));
  if (!n) return 20;
  return TIMES.reduce((best, t) => (Math.abs(t - n) < Math.abs(best - n) ? t : best), 20);
};

/** Which column is which, found by its header. */
type Cols = { q: number; answers: number[]; correct: number; time: number; right: number; wrong: number[] };
function findColumns(header: string[]): Cols {
  const h = header.map(norm);
  const find = (test: (s: string, raw: string) => boolean) => h.findIndex((s, i) => test(s, header[i]));
  // "Question #" / "Question number" is a row number, not the question.
  const isNumber = (raw: string) => /#|\bno\.?$|number/i.test(raw);
  return {
    q: find((s, raw) => !isNumber(raw) && (s.startsWith("question text") || s === "question" || (s.startsWith("question") && !s.startsWith("question type")))),
    answers: h.map((s, i) => (/^(answer|option|choice) ?[1-6]\b/.test(s) ? i : -1)).filter((i) => i >= 0),
    correct: find((s) => s.startsWith("correct answer") || s === "correct" || s.startsWith("correct option") || s === "answer key"),
    time: find((s) => s.startsWith("time")),
    right: find((s) => s.startsWith("correct answer")),
    wrong: h.map((s, i) => (/^(incorrect|wrong) answer/.test(s) ? i : -1)).filter((i) => i >= 0),
  };
}

/** Correct answers written as numbers ("2", "1,3"), letters ("B") or the answer text itself. */
function correctIndexes(raw: string, choices: string[]): number[] {
  const parts = raw.split(/[,;/|]| and /i).map((p) => p.trim()).filter(Boolean);
  const out = new Set<number>();
  for (const p of parts) {
    if (/^\d+$/.test(p)) out.add(Number(p) - 1);
    else if (/^[a-d]$/i.test(p)) out.add(p.toUpperCase().charCodeAt(0) - 65);
    else {
      const i = choices.findIndex((c) => norm(c) === norm(p));
      if (i >= 0) out.add(i);
    }
  }
  return [...out].filter((i) => i >= 0 && i < choices.length);
}

const shuffle = <T,>(a: T[]): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};

export function importQuestions(text: string): ImportResult {
  const rows = parseCsv(text);
  const skipped: string[] = [];
  const questions: Question[] = [];
  const push = (q: Question) => questions.length < LIMITS.questions && questions.push(q);
  if (rows.length === 0) return { format: "nothing", questions, skipped: ["The file is empty."] };

  // Find the header: the first of the top rows that names a question column.
  let headerAt = -1;
  for (let i = 0; i < Math.min(6, rows.length); i++) {
    if (rows[i].some((c) => /^question\b/i.test(c) && !/^question ?(#|no\b|number)/i.test(c))) {
      headerAt = i;
      break;
    }
  }

  // No header with a question column: term/definition pairs (flashcards) or Question,Answer without a header.
  if (headerAt < 0) {
    const pairs = rows.filter((r) => r.length >= 2 && r[0] && r[1]).map((r) => [clip(r[0], LIMITS.prompt), clip(r[1], LIMITS.choice)] as const);
    if (pairs.length === 0) return { format: "unknown", questions, skipped: ["Couldn't find any questions. Use one of the templates below."] };
    const defs = pairs.map((p) => p[1]);
    pairs.forEach(([term, def], i) => {
      const others = shuffle(defs.filter((d) => norm(d) !== norm(def))).slice(0, 3);
      if (others.length >= 1) {
        const choices = shuffle([def, ...others]);
        push({ id: newId(i), type: "choice", prompt: term, choices, correct: [choices.indexOf(def)], time: 20, points: 1 });
      } else push({ id: newId(i), type: "type", prompt: term, accepted: [def], time: 20, points: 1 });
    });
    return { format: pairs.length >= 4 ? "Term & definition list" : "Question & answer list", questions, skipped };
  }

  const header = rows[headerAt];
  const cols = findColumns(header);
  const body = rows.slice(headerAt + 1);
  const isGimkit = cols.wrong.length > 0 && cols.right >= 0;
  const headText = header.join(" ").toLowerCase();
  const format = isGimkit
    ? "Gimkit"
    : headText.includes("question text") && headText.includes("only include answer")
      ? "Blooket"
      : headText.includes("max 120 characters") || headText.includes("choose at least one")
        ? "Kahoot"
        : "CSV";

  body.forEach((r, i) => {
    const line = headerAt + i + 2;
    const prompt = clip(r[cols.q] ?? "", LIMITS.prompt);
    if (!prompt) return skipped.push(`Row ${line}: no question.`);
    const time = cols.time >= 0 ? nearestTime(r[cols.time] ?? "") : 20;
    if (isGimkit) {
      const right = clip(r[cols.right] ?? "", LIMITS.choice);
      const wrong = cols.wrong.map((c) => clip(r[c] ?? "", LIMITS.choice)).filter(Boolean).slice(0, 3);
      if (!right) return skipped.push(`Row ${line}: no correct answer.`);
      if (wrong.length === 0) return push({ id: newId(i), type: "type", prompt, accepted: [right], time, points: 1 });
      const choices = shuffle([right, ...wrong]);
      return push({ id: newId(i), type: "choice", prompt, choices, correct: [choices.indexOf(right)], time, points: 1 });
    }
    const choices = cols.answers.map((c) => clip(r[c] ?? "", LIMITS.choice)).filter(Boolean).slice(0, 4);
    const correctRaw = cols.correct >= 0 ? (r[cols.correct] ?? "") : "";
    if (choices.length >= 2) {
      const correct = correctIndexes(correctRaw, choices);
      if (correct.length === 0) return skipped.push(`Row ${line}: couldn't tell which answer is right${correctRaw ? ` ("${correctRaw}")` : ""}.`);
      const tf = choices.length === 2 && choices.every((c) => /^(true|false)$/i.test(c));
      if (tf) return push({ id: newId(i), type: "truefalse", prompt, choices: ["True", "False"], correct: [/^true$/i.test(choices[correct[0]]) ? 0 : 1], time, points: 1 });
      return push({ id: newId(i), type: "choice", prompt, choices, correct, time, points: 1 });
    }
    // One answer (or none listed as choices): a typed answer.
    const accepted = (correctRaw || choices[0] || "")
      .split(/[|;]/)
      .map((a) => clip(a.trim(), LIMITS.choice))
      .filter(Boolean)
      .slice(0, LIMITS.accepted);
    if (accepted.length === 0) return skipped.push(`Row ${line}: no answer.`);
    push({ id: newId(i), type: "type", prompt, accepted, time, points: 1 });
  });
  if (body.length > LIMITS.questions) skipped.push(`Only the first ${LIMITS.questions} questions were kept (a set's limit).`);
  return { format, questions, skipped };
}

/** A template people can download and fill in. */
export const CSV_TEMPLATE = [
  "Question,Answer 1,Answer 2,Answer 3,Answer 4,Correct,Time",
  '"What is 2 + 2?",3,4,5,6,2,20',
  '"Which are planets? (pick all)",Mars,Moon,Venus,Sun,"1,3",30',
  '"The sky is blue.",True,False,,,1,10',
  '"Capital of France? (type it)",Paris,,,,,20',
].join("\r\n");
