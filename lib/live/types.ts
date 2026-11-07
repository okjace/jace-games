/**
 * Jace Games Live: question sets and the games hosted from them.
 *
 * A set holds questions. Players are never sent anything that gives the
 * answer away: `forPlayers()` strips correct answers (and for custom-HTML
 * questions, the accepted values) before a question leaves the server.
 */

export type QuestionType = "choice" | "truefalse" | "type" | "html";

export type Question = {
  id: string;
  type: QuestionType;
  /** The question text (plain text). */
  prompt: string;
  /**
   * Optional HTML shown with the question (all types), or for "html"
   * questions the whole interactive question. It runs in a sandboxed iframe
   * with no network access; "html" questions answer with jace.answer(value).
   */
  html?: string;
  /** choice: 2–4 options. truefalse: ["True", "False"]. */
  choices?: string[];
  /** choice / truefalse: indexes of the right options. */
  correct?: number[];
  /** type / html: accepted answers (compared ignoring case, spaces and punctuation at the ends). */
  accepted?: string[];
  /** Seconds to answer in Classic. */
  time: number;
  /** 1 = normal, 2 = double points, 0 = no points (a poll). */
  points: 0 | 1 | 2;
};

export type PlayerQuestion = Omit<Question, "correct" | "accepted">;

export type LiveSet = {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  description: string;
  cover: string;
  tags: string[];
  visibility: "public" | "unlisted" | "private";
  questions: Question[];
  plays: number;
  removed: boolean;
  created_at: string;
  updated_at: string;
};

export type SetSummary = Omit<LiveSet, "questions"> & { questionCount: number };

export type LiveMode = "classic" | "gold" | "rocket" | "tower" | "snack" | "factory" | "fishing" | "hack" | "baseball" | "custom";

export type ModeDef = {
  name: string;
  icon: string;
  blurb: string;
  needsSet: boolean;
  selfPaced: boolean;
  /** How a score reads, e.g. "💰 1,200". */
  unit: (n: number) => string;
};

const num = (n: number) => n.toLocaleString("en-US");

export const MODES: Record<LiveMode, ModeDef> = {
  classic: {
    name: "Classic",
    icon: "🏁",
    blurb: "Everyone answers the same question on the big screen. Faster right answers score more.",
    needsSet: true,
    selfPaced: false,
    unit: num,
  },
  gold: {
    name: "Gold Rush",
    icon: "💰",
    blurb: "Answer at your own pace. Every right answer opens a chest: gold, double it, or steal and swap with others.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => "💰 " + num(n),
  },
  rocket: {
    name: "Rocket Race",
    icon: "🚀",
    blurb: "Right answers boost your rocket. First to 100% wins.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => n + "%",
  },
  tower: {
    name: "Tower Siege",
    icon: "🏰",
    blurb: "Earn coins, build and upgrade towers, then send the next wave. Hold out the longest to win.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => "🏰 " + num(n),
  },
  snack: {
    name: "Snack Shack",
    icon: "🍔",
    blurb: "Answer to restock, serve hungry customers before they walk out, and upgrade your shack. Most cash wins.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => "$" + num(n),
  },
  factory: {
    name: "Gadget Factory",
    icon: "🏭",
    blurb: "Earn coins to buy machines that build gadgets for you. Watch for power surges and glitches. Most gadgets wins.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => "⚙️ " + num(n),
  },
  fishing: {
    name: "Lake Frenzy",
    icon: "🎣",
    blurb: "Every right answer is a cast. Reel in fish, rare lake monsters, junk and frenzies. Heaviest haul wins.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => num(n) + " lb",
  },
  hack: {
    name: "Code Breakers",
    icon: "🕵️",
    blurb: "Pick a secret password, mine bits, and crack rivals' passwords to steal theirs. Most bits wins.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => num(n) + " bits",
  },
  baseball: {
    name: "Home Run Derby",
    icon: "⚾",
    blurb: "Every right answer is an at-bat: time your swing to hit singles, doubles and homers. Wrong answers are outs. Most runs wins.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => num(n) + (n === 1 ? " run" : " runs"),
  },
  custom: {
    name: "Studio game",
    icon: "🧩",
    blurb: "Play a game someone made in Game Studio. Right answers earn coins to spend in it.",
    needsSet: false,
    selfPaced: true,
    unit: (n) => num(n) + " pts",
  },
};

/** Modes whose mini-game runs on the player's device; the server caps their score by what they earned. */
export const DEVICE_MODES: LiveMode[] = ["tower", "snack", "factory", "custom"];

export const LIMITS = {
  title: 80,
  description: 400,
  tags: 6,
  tag: 24,
  questions: 100,
  prompt: 300,
  choice: 120,
  accepted: 10,
  html: 64 * 1024,
  setBytes: 1024 * 1024,
  name: 20,
  minTime: 5,
  maxTime: 120,
};

/** Normalizes a typed answer for comparison. */
export function normAnswer(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/^[\s"'.,!?]+|[\s"'.,!?]+$/g, "")
    .replace(/\s+/g, " ");
}

/** What a player's device gets: the question without its answers. */
export function forPlayers(q: Question): PlayerQuestion {
  const { correct, accepted, ...rest } = q;
  void correct;
  void accepted;
  return rest;
}

/** Checks an answer: choice/truefalse take an index, type/html take text. */
export function isCorrect(q: Question, answer: unknown): boolean {
  if (q.type === "choice" || q.type === "truefalse") {
    return typeof answer === "number" && (q.correct ?? []).includes(answer);
  }
  if (typeof answer !== "string") return false;
  const a = normAnswer(answer);
  return !!a && (q.accepted ?? []).some((x) => normAnswer(x) === a);
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/**
 * Cleans a set's questions from the editor. Returns the questions, or why
 * they can't be saved. Unfinished questions are allowed while editing; the
 * host page only offers sets with at least one playable question.
 */
export function cleanQuestions(raw: unknown): { ok: true; questions: Question[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) return { ok: false, error: "Questions must be a list." };
  if (raw.length > LIMITS.questions) return { ok: false, error: `A set can have at most ${LIMITS.questions} questions.` };
  const out: Question[] = [];
  for (const [i, r] of raw.entries()) {
    const q = (r ?? {}) as Record<string, unknown>;
    const type = (["choice", "truefalse", "type", "html"] as const).find((t) => t === q.type);
    if (!type) return { ok: false, error: `Question ${i + 1} has an unknown type.` };
    const html = typeof q.html === "string" && q.html.trim() ? q.html : undefined;
    if (html && html.length > LIMITS.html) return { ok: false, error: `Question ${i + 1}'s HTML is over 64 KB.` };
    const time = Math.min(LIMITS.maxTime, Math.max(LIMITS.minTime, Math.round(Number(q.time) || 20)));
    const points = q.points === 0 || q.points === 2 ? q.points : 1;
    const base = {
      id: typeof q.id === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(q.id) ? q.id : `q${i}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      prompt: str(q.prompt, LIMITS.prompt),
      ...(html ? { html } : {}),
      time,
      points: points as 0 | 1 | 2,
    };
    if (type === "choice" || type === "truefalse") {
      const choices =
        type === "truefalse"
          ? ["True", "False"]
          : (Array.isArray(q.choices) ? q.choices : []).slice(0, 4).map((c) => str(c, LIMITS.choice));
      const correct = (Array.isArray(q.correct) ? q.correct : [])
        .filter((n): n is number => Number.isInteger(n) && n >= 0 && n < choices.length)
        .slice(0, choices.length);
      out.push({ ...base, choices, correct: [...new Set(correct)] });
    } else {
      const accepted = (Array.isArray(q.accepted) ? q.accepted : [])
        .map((a) => str(a, LIMITS.choice).trim())
        .filter(Boolean)
        .slice(0, LIMITS.accepted);
      out.push({ ...base, accepted });
    }
  }
  return { ok: true, questions: out };
}

/** A question can be played once it has a prompt (or HTML) and a right answer. */
export function isPlayable(q: Question): boolean {
  const hasPrompt = !!q.prompt.trim() || !!q.html;
  if (q.type === "choice") return hasPrompt && (q.choices ?? []).filter((c) => c.trim()).length >= 2 && (q.correct ?? []).length > 0 && (q.choices ?? []).every((c) => c.trim());
  if (q.type === "truefalse") return hasPrompt && (q.correct ?? []).length > 0;
  if (q.type === "html") return !!q.html && (q.accepted ?? []).length > 0;
  return hasPrompt && (q.accepted ?? []).length > 0;
}

/** Cleans a player's nickname. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.name);
  return name.length >= 1 ? name : null;
}
