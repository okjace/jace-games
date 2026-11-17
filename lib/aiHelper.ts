import { SDK_TEXT } from "./studio/sdkDocs";
import { LIMITS, cleanQuestions, type Question } from "./live/types";

/**
 * The AI helper: builds a prompt to paste into any AI (ChatGPT, Claude,
 * Gemini… whatever the person already uses, free), then reads the answer
 * pasted back. Nothing is sent anywhere by Jace Live, and nothing here costs
 * money. Anything made this way is marked "made with AI".
 */

const RULES = [
  "Keep it kid-friendly: nothing scary, violent, mean or grown-up.",
  "Make it original: don't copy a real game's name, characters, art, music or levels.",
];

/** A prompt for a Studio game (or for changing the current one). */
export function gamePrompt(description: string, currentCode?: string): string {
  return [
    "Write a small browser game for Jace Live Studio, as ONE complete HTML file (inline <style> and <script>, nothing loaded from the internet).",
    "",
    SDK_TEXT,
    "",
    "How the game should work:",
    "- Players spend coins they earn from answering questions. Use jace.live.coins (the total ever earned) minus what the game has spent.",
    "- Include an \"earn coins\" button that calls jace.live.earn().",
    "- Report the score with jace.submitScore(n) as it changes.",
    "- Use jace.theme colours (or the --jl-* CSS variables) so it matches the site, and make it work with touch and mouse, on phones and computers.",
    "- When jace.live is null (testing), start with 50 pretend coins.",
    ...RULES.map((r) => `- ${r}`),
    "",
    currentCode ? `Change my game like this: ${description.trim()}` : `My game idea: ${description.trim()}`,
    ...(currentCode ? ["", "Here is my game right now:", "```html", currentCode, "```"] : []),
    "",
    "Reply with only the finished HTML file in one ```html code block.",
  ].join("\n");
}

/** The game code from an AI's answer: the ```html block, or the HTML in it. */
export function readGameAnswer(text: string): string | null {
  const fenced = text.match(/```(?:html)?\s*\n([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : text).trim();
  if (!/<(script|canvas|div|body|html|style)\b/i.test(body)) return null;
  return body;
}

export type SetPromptOptions = { topic: string; count: number; grade: string; kinds: ("choice" | "truefalse" | "type")[] };

/** A prompt for quiz questions, answered in JSON this reads back. */
export function setPrompt(o: SetPromptOptions): string {
  const kinds = o.kinds.length ? o.kinds : ["choice"];
  return [
    `Write ${Math.max(1, Math.min(LIMITS.questions, o.count))} quiz questions about: ${o.topic.trim()}`,
    o.grade.trim() ? `For: ${o.grade.trim()}` : "",
    `Question types to use: ${kinds.map((k) => (k === "choice" ? "multiple choice" : k === "truefalse" ? "true/false" : "type the answer")).join(", ")}.`,
    "Make sure every answer is correct. Keep them kid-friendly and clear.",
    "",
    "Reply with ONLY a JSON array (in one ```json code block), each item one of these shapes:",
    '{"type":"choice","prompt":"…","choices":["…","…","…","…"],"correct":[0],"time":20}',
    '{"type":"truefalse","prompt":"…","correct":[0],"time":15}   (0 = True, 1 = False)',
    '{"type":"type","prompt":"…","accepted":["answer","other spelling"],"time":25}',
    `Rules: 2-4 choices, "correct" holds the index(es) of the right choice(s), prompts under ${LIMITS.prompt} characters, choices under ${LIMITS.choice}, time in seconds (5-120).`,
  ]
    .filter((l) => l !== "")
    .join("\n");
}

/** Questions from an AI's answer (a JSON array, maybe in a code block). */
export function readSetAnswer(text: string): { ok: true; questions: Question[] } | { ok: false; error: string } {
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
  const raw = (fenced ? fenced[1] : text).trim();
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return { ok: false, error: "couldnt find the questions in that. paste the AI's whole answer (the part in [ ])." };
  let list: unknown;
  try {
    list = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return { ok: false, error: "that answer isnt valid JSON. ask the AI to fix it, then paste again." };
  }
  if (!Array.isArray(list) || list.length === 0) return { ok: false, error: "no questions in that answer." };
  return cleanQuestions(list.slice(0, LIMITS.questions));
}
