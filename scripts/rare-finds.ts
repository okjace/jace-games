/**
 * Builds the "Rare Finds: Name It!" set from supabase/seed/rare-finds.json and
 * prints it as JSON: { set, questions }. Each prompt becomes a typed-answer
 * question whose accepted answers carry a rarity tier (1 common … 5 legendary).
 *
 *   npx tsx scripts/rare-finds.ts > rare-finds.out.json
 */
import { readFileSync } from "node:fs";
import { cleanQuestions, normAnswer } from "../lib/live/types";
import { isRareSet } from "../lib/live/rare";

type Seed = { id: string; title: string; description: string; cover: string; tags: string[]; prompts: { prompt: string; answers: [number, ...string[]][] }[] };

const seed = JSON.parse(readFileSync(new URL("../supabase/seed/rare-finds.json", import.meta.url), "utf8")) as Seed;

const raw = seed.prompts.map((p, i) => {
  const accepted: string[] = [];
  const rarity: Record<string, number> = {};
  for (const [tier, ...names] of p.answers) {
    for (const n of names) {
      if (rarity[normAnswer(n)] !== undefined) throw new Error(`"${n}" twice in "${p.prompt}"`);
      accepted.push(n);
      rarity[normAnswer(n)] = tier;
    }
  }
  return { id: `rare-${String(i + 1).padStart(2, "0")}`, type: "type", prompt: p.prompt, accepted, rarity, time: 25, points: 1 };
});

const res = cleanQuestions(raw);
if (!res.ok) throw new Error(res.error);
const lost = res.questions.filter((q, i) => Object.keys(q.rarity ?? {}).length !== Object.keys(raw[i].rarity).length);
if (lost.length) throw new Error(`rarity dropped for: ${lost.map((q) => q.prompt).join(", ")}`);
if (!isRareSet(res.questions)) throw new Error("not a Rare Finds set");

const { prompts, ...set } = seed;
void prompts;
process.stdout.write(JSON.stringify({ set, questions: res.questions }));
