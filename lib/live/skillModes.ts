import "server-only";
import { randomInt } from "crypto";
import type { LivePlayerRow } from "@/lib/db/live";
import {
  KING_MAX_SHIELD,
  KING_START_SHIELD,
  MAX_MOVES,
  MEMORY_COMBO,
  MEMORY_FACES,
  MEMORY_MATCH,
  PLAYER_COLORS,
  STACK_PERFECT,
  STACK_START_WIDTH,
  STEAL_COST,
  SWEEP_BOOM,
  SWEEP_CLEAR,
  SWEEP_MINES,
  SWEEP_SIZE,
  TERRITORY_SIZE,
  VAULT_LENGTH,
  VAULT_SYMBOLS,
  memoryClear,
  memoryPairs,
  movesFor,
  stackPeriod,
  stackPos,
  vaultPoints,
  type SkillMode,
  type SkillView,
} from "./skillRules";

/**
 * The server side of the six skill modes (rules in skillRules.ts). Every
 * player's state lives in their own row (data.sk), so players never write
 * over each other: the shared Territory map and the King of the Hill crown
 * are worked out from everyone's rows.
 */

export type SkillData = {
  moves?: number;
  /** Territory: square → when you claimed it. The latest claim owns a square. */
  claims?: Record<string, number>;
  vault?: { code: number[]; guesses: { g: number[]; exact: number; near: number }[] };
  cracked?: number;
  /** King: when you took the crown (null once you lose it), and your shield. */
  crownAt?: number | null;
  shield?: number;
  /** King: time already counted into your score while you held the crown. */
  creditedAt?: number;
  mem?: { cards: string[]; matched: number[]; open: number[]; level: number; combo: number; miss?: number[] };
  sweep?: { mines: number[] | null; open: number[]; flags: number[]; boards: number };
  stack?: { blocks: { x: number; w: number }[]; block: { issuedAt: number; width: number; period: number } | null; best: number };
};

export type SkillOp =
  | { op: "claim"; cell: number }
  | { op: "crack"; code: number[] }
  | { op: "attack" }
  | { op: "fortify" }
  | { op: "flip"; cell: number }
  | { op: "reveal"; cell: number }
  | { op: "flag"; cell: number }
  | { op: "block" }
  | { op: "drop"; t: number };

/** A change to one player's row. */
export type Patch = { id: string; score?: number; sk: SkillData; last?: Record<string, unknown> };

export class SkillError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

const skOf = (p: LivePlayerRow): SkillData => ((p.data ?? {}) as { sk?: SkillData }).sk ?? {};
const order = (all: LivePlayerRow[]) => [...all].sort((a, b) => a.joined_at.localeCompare(b.joined_at) || a.id.localeCompare(b.id));

/** A right answer: more moves (up to the cap). */
export function earnMoves(mode: SkillMode, me: LivePlayerRow): { sk: SkillData; gain: number } {
  const sk = skOf(me);
  const gain = movesFor(mode, me.streak);
  return { sk: { ...sk, moves: Math.min(MAX_MOVES, (sk.moves ?? 0) + gain) }, gain };
}

function spend(sk: SkillData, n = 1): SkillData {
  if ((sk.moves ?? 0) < n) throw new SkillError(n > 1 ? `That needs ${n} moves. Answer questions to earn more!` : "No moves left. Answer a question to earn more!", 409);
  return { ...sk, moves: (sk.moves ?? 0) - n };
}

// ---------- Territory Wars ----------

function territoryBoard(all: LivePlayerRow[]) {
  const size = TERRITORY_SIZE;
  const owner = new Array<number>(size * size).fill(-1);
  const at = new Array<number>(size * size).fill(0);
  const players = order(all);
  players.forEach((p, i) => {
    for (const [cell, t] of Object.entries(skOf(p).claims ?? {})) {
      const c = Number(cell);
      if (c >= 0 && c < owner.length && t > at[c]) {
        at[c] = t;
        owner[c] = i;
      }
    }
  });
  return { size, owner, players };
}

const neighbours = (c: number, size: number) => {
  const x = c % size;
  const y = Math.floor(c / size);
  return [
    [x - 1, y],
    [x + 1, y],
    [x, y - 1],
    [x, y + 1],
  ]
    .filter(([a, b]) => a >= 0 && b >= 0 && a < size && b < size)
    .map(([a, b]) => b * size + a);
};

/** Boxed in on every side by its owner's land (or the edge): can't be stolen. */
const isSafe = (c: number, owner: number[], size: number) => owner[c] >= 0 && neighbours(c, size).every((n) => owner[n] === owner[c]);

function claim(me: LivePlayerRow, all: LivePlayerRow[], cell: number, now: number): Patch[] {
  const { size, owner, players } = territoryBoard(all);
  if (!Number.isInteger(cell) || cell < 0 || cell >= size * size) throw new SkillError("That square isn't on the map.");
  const mine = players.findIndex((p) => p.id === me.id);
  if (owner[cell] === mine) throw new SkillError("That square is already yours.");
  const hasLand = owner.some((o) => o === mine);
  if (hasLand && !neighbours(cell, size).some((n) => owner[n] === mine)) throw new SkillError("Claim a square next to your land.");
  const steal = owner[cell] >= 0;
  if (steal && isSafe(cell, owner, size)) throw new SkillError("That square is boxed in by its owner's land, so it can't be taken.");
  let sk = spend(skOf(me), steal ? STEAL_COST : 1);
  sk = { ...sk, claims: { ...(sk.claims ?? {}), [cell]: now } };
  // Scores are squares owned: update everyone whose count changed.
  const after = [...owner];
  after[cell] = mine;
  const patches: Patch[] = [];
  players.forEach((p, i) => {
    const count = after.filter((o) => o === i).length;
    if (p.id === me.id) patches.push({ id: p.id, score: count, sk, last: { kind: "claim", cell, steal, from: steal ? players[owner[cell]].name : null } });
    else if (i === owner[cell]) patches.push({ id: p.id, score: count, sk: skOf(p), last: { kind: "stolen", by: me.name, cell } });
  });
  return patches;
}

// ---------- Vault Cracker ----------

function newVault(): NonNullable<SkillData["vault"]> {
  const pool = VAULT_SYMBOLS.map((_, i) => i);
  const code: number[] = [];
  while (code.length < VAULT_LENGTH) code.push(pool.splice(randomInt(pool.length), 1)[0]);
  return { code, guesses: [] };
}

function crack(me: LivePlayerRow, guess: unknown): Patch[] {
  if (!Array.isArray(guess) || guess.length !== VAULT_LENGTH || guess.some((n) => !Number.isInteger(n) || n < 0 || n >= VAULT_SYMBOLS.length)) {
    throw new SkillError(`Pick ${VAULT_LENGTH} symbols.`);
  }
  if (new Set(guess).size !== VAULT_LENGTH) throw new SkillError("Each symbol is only in the code once: no repeats.");
  let sk = spend(skOf(me));
  const vault = sk.vault ?? newVault();
  const g = guess as number[];
  const exact = g.filter((n, i) => vault.code[i] === n).length;
  const near = g.filter((n, i) => vault.code[i] !== n && vault.code.includes(n)).length;
  const guesses = [...vault.guesses, { g, exact, near }];
  if (exact === VAULT_LENGTH) {
    const pts = vaultPoints(guesses.length);
    sk = { ...sk, vault: newVault(), cracked: (sk.cracked ?? 0) + 1 };
    return [{ id: me.id, score: me.score + pts, sk, last: { kind: "cracked", guesses: guesses.length, points: pts, code: vault.code } }];
  }
  sk = { ...sk, vault: { ...vault, guesses } };
  return [{ id: me.id, sk, last: { kind: "vault-guess", exact, near } }];
}

// ---------- King of the Hill ----------

function currentKing(all: LivePlayerRow[]): LivePlayerRow | null {
  let best: LivePlayerRow | null = null;
  for (const p of all) {
    const at = skOf(p).crownAt;
    if (at && (!best || at > (skOf(best).crownAt ?? 0))) best = p;
  }
  return best;
}

/** The king's score counts whole seconds on the throne, added up whenever their row changes. */
function credit(king: LivePlayerRow, sk: SkillData, now: number): { score: number; sk: SkillData } {
  const from = Math.max(sk.creditedAt ?? 0, sk.crownAt ?? now);
  const secs = Math.max(0, Math.floor((now - from) / 1000));
  return { score: king.score + secs, sk: { ...sk, creditedAt: from + secs * 1000 } };
}

function kingMove(me: LivePlayerRow, all: LivePlayerRow[], op: "attack" | "fortify", now: number): Patch[] {
  const king = currentKing(all);
  let sk = spend(skOf(me));
  if (!king) {
    // An empty throne: take it.
    sk = { ...sk, crownAt: now, creditedAt: now, shield: KING_START_SHIELD };
    return [{ id: me.id, sk, last: { kind: "crowned", from: null } }];
  }
  if (king.id === me.id) {
    if (op !== "fortify") throw new SkillError("You're the king! Fortify your shield instead.");
    const c = credit(me, sk, now);
    const shield = Math.min(KING_MAX_SHIELD, (sk.shield ?? 0) + 1);
    return [{ id: me.id, score: c.score, sk: { ...c.sk, shield }, last: { kind: "fortified", shield } }];
  }
  if (op !== "attack") throw new SkillError("Only the king can fortify.");
  const ksk = skOf(king);
  const hit = me.streak >= 3 ? 2 : 1;
  const shield = (ksk.shield ?? 0) - hit;
  if (shield > 0) {
    return [
      { id: me.id, sk, last: { kind: "attacked", hit, shield, king: king.name } },
      { id: king.id, sk: { ...ksk, shield }, last: { kind: "under-attack", by: me.name, shield } },
    ];
  }
  // The crown falls: bank the old king's time, crown the attacker.
  const c = credit(king, ksk, now);
  return [
    { id: me.id, sk: { ...sk, crownAt: now, creditedAt: now, shield: KING_START_SHIELD }, last: { kind: "crowned", from: king.name } },
    { id: king.id, score: c.score, sk: { ...c.sk, crownAt: null, shield: 0 }, last: { kind: "dethroned", by: me.name } },
  ];
}

/** A wrong answer while king cracks your own shield; at zero the throne is empty. */
export function kingWrong(me: LivePlayerRow, all: LivePlayerRow[], now: number): Patch | null {
  const king = currentKing(all);
  if (!king || king.id !== me.id) return null;
  const sk = skOf(me);
  const shield = (sk.shield ?? 0) - 1;
  if (shield > 0) return { id: me.id, sk: { ...sk, shield }, last: { kind: "cracked-shield", shield } };
  const c = credit(me, sk, now);
  return { id: me.id, score: c.score, sk: { ...c.sk, crownAt: null, shield: 0 }, last: { kind: "fell", shield: 0 } };
}

/** When the game ends: count the king's last stretch on the throne. */
export function kingFinal(all: LivePlayerRow[], now: number): Patch | null {
  const king = currentKing(all);
  if (!king) return null;
  const c = credit(king, skOf(king), now);
  return { id: king.id, score: c.score, sk: c.sk };
}

// ---------- Memory Match ----------

function newMemory(level: number): NonNullable<SkillData["mem"]> {
  const pairs = memoryPairs(level);
  const faces = [...MEMORY_FACES].sort(() => randomInt(3) - 1).slice(0, pairs);
  const cards = [...faces, ...faces];
  for (let i = cards.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return { cards, matched: [], open: [], level, combo: 0 };
}

function flip(me: LivePlayerRow, cell: number): Patch[] {
  let sk = skOf(me);
  const mem = sk.mem ?? newMemory(1);
  if (!Number.isInteger(cell) || cell < 0 || cell >= mem.cards.length) throw new SkillError("Pick a card.");
  if (mem.matched.includes(cell) || mem.open.includes(cell)) throw new SkillError("That card is already face up.");
  // The first card of a turn costs a move; the second is part of the same turn.
  if (mem.open.length === 0) sk = spend(sk);
  const open = [...mem.open, cell];
  if (open.length < 2) return [{ id: me.id, sk: { ...sk, mem: { ...mem, open, miss: undefined } }, last: { kind: "flip", cell } }];
  const [a, b] = open;
  if (mem.cards[a] !== mem.cards[b]) {
    // No match: both show until the next flip; the combo resets.
    return [{ id: me.id, sk: { ...sk, mem: { ...mem, open: [], combo: 0, miss: [a, b] } }, last: { kind: "mismatch", a, b, faces: [mem.cards[a], mem.cards[b]] } }];
  }
  const matched = [...mem.matched, a, b];
  const pts = MEMORY_MATCH + mem.combo * MEMORY_COMBO;
  // A match gives the move back, so you keep going.
  sk = { ...sk, moves: Math.min(MAX_MOVES, (sk.moves ?? 0) + 1) };
  if (matched.length === mem.cards.length) {
    const bonus = memoryClear(mem.level);
    return [{ id: me.id, score: me.score + pts + bonus, sk: { ...sk, mem: newMemory(mem.level + 1) }, last: { kind: "cleared", points: pts + bonus, level: mem.level } }];
  }
  return [{ id: me.id, score: me.score + pts, sk: { ...sk, mem: { ...mem, matched, open: [], combo: mem.combo + 1, miss: undefined } }, last: { kind: "match", points: pts, combo: mem.combo + 1, face: mem.cards[a] } }];
}

// ---------- Minefield ----------

const sweepNeighbours = (c: number) => {
  const s = SWEEP_SIZE;
  const x = c % s;
  const y = Math.floor(c / s);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && x + dx >= 0 && y + dy >= 0 && x + dx < s && y + dy < s) out.push((y + dy) * s + x + dx);
  return out;
};

const newSweep = (boards: number): NonNullable<SkillData["sweep"]> => ({ mines: null, open: [], flags: [], boards });

function reveal(me: LivePlayerRow, cell: number): Patch[] {
  let sk = skOf(me);
  const sw = sk.sweep ?? newSweep(0);
  const total = SWEEP_SIZE * SWEEP_SIZE;
  if (!Number.isInteger(cell) || cell < 0 || cell >= total) throw new SkillError("Pick a square.");
  if (sw.open.includes(cell)) throw new SkillError("That square is already open.");
  if (sw.flags.includes(cell)) throw new SkillError("Take the flag off first.");
  sk = spend(sk);
  // The first square of a board is always safe, and so are its neighbours.
  let mines = sw.mines;
  if (!mines) {
    const keep = new Set([cell, ...sweepNeighbours(cell)]);
    const pool = Array.from({ length: total }, (_, i) => i).filter((i) => !keep.has(i));
    mines = [];
    while (mines.length < SWEEP_MINES) mines.push(pool.splice(randomInt(pool.length), 1)[0]);
  }
  if (mines.includes(cell)) {
    return [{ id: me.id, score: Math.max(0, me.score - SWEEP_BOOM), sk: { ...sk, sweep: newSweep(sw.boards) }, last: { kind: "boom", cell, mines, lost: Math.min(me.score, SWEEP_BOOM) } }];
  }
  // Open it, and flood out from any square with no mines around it.
  const mineSet = new Set(mines);
  const open = new Set(sw.open);
  const queue = [cell];
  let opened = 0;
  while (queue.length) {
    const c = queue.pop()!;
    if (open.has(c) || mineSet.has(c)) continue;
    open.add(c);
    opened++;
    if (sweepNeighbours(c).every((n) => !mineSet.has(n))) queue.push(...sweepNeighbours(c));
  }
  const flags = sw.flags.filter((f) => !open.has(f));
  if (open.size === total - SWEEP_MINES) {
    return [{ id: me.id, score: me.score + opened + SWEEP_CLEAR, sk: { ...sk, sweep: newSweep(sw.boards + 1) }, last: { kind: "swept", opened, bonus: SWEEP_CLEAR } }];
  }
  return [{ id: me.id, score: me.score + opened, sk: { ...sk, sweep: { ...sw, mines, open: [...open], flags } }, last: { kind: "opened", opened } }];
}

function flag(me: LivePlayerRow, cell: number): Patch[] {
  const sk = skOf(me);
  const sw = sk.sweep ?? newSweep(0);
  if (!Number.isInteger(cell) || cell < 0 || cell >= SWEEP_SIZE * SWEEP_SIZE || sw.open.includes(cell)) throw new SkillError("Flag a closed square.");
  const flags = sw.flags.includes(cell) ? sw.flags.filter((f) => f !== cell) : [...sw.flags, cell];
  return [{ id: me.id, sk: { ...sk, sweep: { ...sw, flags } }, last: { kind: "flag" } }];
}

// ---------- Sky Stacker ----------

function newBlock(sk: SkillData, now: number) {
  const blocks = sk.stack?.blocks ?? [];
  const width = blocks.length ? blocks[blocks.length - 1].w : STACK_START_WIDTH;
  return { issuedAt: now, width, period: stackPeriod(blocks.length) };
}

function stackBlock(me: LivePlayerRow, now: number): Patch[] {
  let sk = skOf(me);
  if (sk.stack?.block) throw new SkillError("Drop the block you've got first.", 409);
  sk = spend(sk);
  const stack = sk.stack ?? { blocks: [], block: null, best: 0 };
  return [{ id: me.id, sk: { ...sk, stack: { ...stack, block: newBlock(sk, now) } }, last: { kind: "block" } }];
}

function drop(me: LivePlayerRow, t: unknown, now: number): Patch[] {
  const sk = skOf(me);
  const stack = sk.stack ?? { blocks: [], block: null, best: 0 };
  const b = stack.block;
  if (!b) throw new SkillError("Get a block first.", 409);
  // The player's clock says when they tapped; it can't be later than now (allowing for lag) or before the block appeared.
  const age = Math.max(0, Math.min(Number(t) || 0, now - b.issuedAt + 400));
  const x = stackPos(age, b.width, b.period);
  const below = stack.blocks[stack.blocks.length - 1] ?? { x: (100 - STACK_START_WIDTH) / 2, w: STACK_START_WIDTH };
  const left = Math.max(x, below.x);
  const right = Math.min(x + b.width, below.x + below.w);
  const overlap = right - left;
  if (overlap <= 0) {
    // A miss: the tower comes down (points already earned stay).
    return [{ id: me.id, sk: { ...sk, stack: { blocks: [], block: null, best: stack.best } }, last: { kind: "toppled", height: stack.blocks.length, x } }];
  }
  const perfect = Math.abs(x - below.x) <= STACK_PERFECT;
  // A perfect drop keeps the full width (and wins a little back).
  const placed = perfect ? { x: below.x, w: Math.min(STACK_START_WIDTH, below.w + 2) } : { x: left, w: overlap };
  const blocks = [...stack.blocks, placed];
  const pts = 5 + Math.round(placed.w / 6) + (perfect ? 10 : 0);
  return [
    {
      id: me.id,
      score: me.score + pts,
      sk: { ...sk, stack: { blocks, block: null, best: Math.max(stack.best, blocks.length) } },
      last: { kind: "stacked", perfect, points: pts, height: blocks.length, cut: perfect ? 0 : b.width - overlap },
    },
  ];
}

// ---------- Dispatch and views ----------

export function skillMove(mode: SkillMode, me: LivePlayerRow, all: LivePlayerRow[], body: SkillOp, now: number): Patch[] {
  if (mode === "territory" && body.op === "claim") return claim(me, all, body.cell, now);
  if (mode === "vault" && body.op === "crack") return crack(me, body.code);
  if (mode === "king" && (body.op === "attack" || body.op === "fortify")) return kingMove(me, all, body.op, now);
  if (mode === "memory" && body.op === "flip") return flip(me, body.cell);
  if (mode === "sweep" && body.op === "reveal") return reveal(me, body.cell);
  if (mode === "sweep" && body.op === "flag") return flag(me, body.cell);
  if (mode === "stack" && body.op === "block") return stackBlock(me, now);
  if (mode === "stack" && body.op === "drop") return drop(me, body.t, now);
  throw new SkillError("Unknown move.");
}

export function skillView(mode: SkillMode, me: LivePlayerRow, all: LivePlayerRow[], now: number): SkillView {
  const sk = skOf(me);
  const view: SkillView = { mode, moves: sk.moves ?? 0 };
  if (mode === "territory") {
    const { size, owner, players } = territoryBoard(all);
    view.territory = {
      size,
      cells: owner,
      players: players.map((p, i) => ({ name: p.name, color: PLAYER_COLORS[i % PLAYER_COLORS.length], count: owner.filter((o) => o === i).length, you: p.id === me.id })),
      safe: owner.map((_, c) => c).filter((c) => isSafe(c, owner, size)),
    };
  } else if (mode === "vault") {
    view.vault = { length: VAULT_LENGTH, symbols: VAULT_SYMBOLS.length, guesses: sk.vault?.guesses ?? [], cracked: sk.cracked ?? 0 };
  } else if (mode === "king") {
    const king = currentKing(all);
    const ksk = king ? skOf(king) : null;
    view.king = {
      king: king && ksk ? { name: king.name, you: king.id === me.id, shield: ksk.shield ?? 0, since: ksk.crownAt ?? now } : null,
      heldMs: king && ksk ? now - Math.max(ksk.creditedAt ?? 0, ksk.crownAt ?? now) : 0,
      maxShield: KING_MAX_SHIELD,
    };
  } else if (mode === "memory") {
    const mem = sk.mem ?? newMemoryShape(1);
    const shown = new Set([...mem.matched, ...mem.open, ...(mem.miss ?? [])]);
    view.memory = { faces: mem.cards.map((f, i) => (shown.has(i) ? f : null)), open: mem.open, level: mem.level, combo: mem.combo, pairs: mem.cards.length / 2 };
  } else if (mode === "sweep") {
    const sw = sk.sweep ?? newSweep(0);
    const mineSet = new Set(sw.mines ?? []);
    const openSet = new Set(sw.open);
    view.sweep = {
      size: SWEEP_SIZE,
      mines: SWEEP_MINES,
      cells: Array.from({ length: SWEEP_SIZE * SWEEP_SIZE }, (_, c) => (openSet.has(c) ? sweepNeighbours(c).filter((n) => mineSet.has(n)).length : null)),
      flags: sw.flags,
      boards: sw.boards,
    };
  } else if (mode === "stack") {
    const st = sk.stack ?? { blocks: [], block: null, best: 0 };
    view.stack = { blocks: st.blocks, block: st.block ? { width: st.block.width, period: st.block.period, age: now - st.block.issuedAt } : null, best: st.best };
  }
  return view;
}

/** The layout of a fresh memory board without dealing it (faces are hidden anyway). */
function newMemoryShape(level: number): NonNullable<SkillData["mem"]> {
  return { cards: new Array<string>(memoryPairs(level) * 2).fill("?"), matched: [], open: [], level, combo: 0 };
}
