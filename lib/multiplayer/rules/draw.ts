import { shuffle } from "../rng";
import type { Rules } from "../types";

/**
 * Draw & Guess for 3–8 players. Each turn one player picks a word from three
 * and draws it (strokes travel over the room's live channel, not through
 * the server); everyone else guesses in the chat. The word only ever leaves
 * the server for the drawer, for players who've guessed it, and at the end
 * of the turn. Timing uses the server clock: any player may send "tick"
 * once a deadline passes and the server moves the game on.
 */

export const CHOOSE_MS = 15_000;
export const DRAW_MS = 80_000;
export const REVEAL_MS = 5_000;

export const WORDS = [
  "apple", "banana", "pizza", "cake", "ice cream", "donut", "carrot", "cheese", "burger", "cookie",
  "cat", "dog", "fish", "bird", "horse", "snake", "spider", "frog", "rabbit", "turtle", "elephant", "giraffe", "penguin", "octopus", "shark", "bee", "butterfly", "owl", "lion", "monkey",
  "house", "castle", "bridge", "tower", "tent", "lighthouse", "igloo", "pyramid", "windmill", "church",
  "car", "bus", "train", "plane", "boat", "rocket", "bicycle", "skateboard", "helicopter", "tractor",
  "sun", "moon", "star", "cloud", "rainbow", "snowman", "volcano", "mountain", "island", "tree", "flower", "cactus", "mushroom", "leaf", "tornado", "lightning",
  "phone", "computer", "keyboard", "camera", "television", "lamp", "clock", "chair", "bed", "door", "key", "umbrella", "glasses", "hat", "shoe", "shirt", "crown", "ring", "backpack", "scissors",
  "guitar", "drum", "piano", "trumpet", "ball", "kite", "robot", "dragon", "ghost", "alien", "pirate", "wizard", "mermaid", "unicorn", "zombie",
  "sword", "shield", "bow", "anchor", "map", "treasure", "candle", "balloon", "present", "trophy", "magnet", "hammer", "ladder", "bucket", "toothbrush",
  "heart", "smile", "eye", "hand", "foot", "nose", "ear", "tooth", "brain", "skeleton",
  "football", "basketball", "tennis", "swimming", "fishing", "camping", "dance", "sleep", "rain", "snow",
  "minecraft", "pickaxe", "diamond", "creeper", "portal", "controller", "joystick", "trophy cup", "headphones", "dice",
];

export type DrawChat = { seat: number; text: string; correct?: boolean; close?: boolean };
export type DrawState = {
  seats: number;
  order: number[];
  idx: number;
  phase: "choose" | "draw" | "reveal" | "over";
  choices: string[];
  word: string | null;
  deadline: number;
  drawStartedAt: number;
  guessed: number[];
  scores: number[];
  chat: DrawChat[];
  gone: number[];
  used: string[];
};
export type DrawMove = { choose: number } | { guess: string } | { tick: true };
export type DrawView = Omit<DrawState, "word" | "choices" | "used" | "chat"> & {
  drawer: number;
  word: string | null;
  hint: string;
  choices: string[];
  chat: DrawChat[];
  lastWord: string | null;
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();

function close(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1 || a === b) return false;
  // One edit away.
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

const drawerOf = (s: DrawState) => s.order[s.idx];

function startTurn(s: DrawState, idx: number, now: number, rng: () => number): DrawState {
  // Skip people who left.
  while (idx < s.order.length && s.gone.includes(s.order[idx])) idx++;
  if (idx >= s.order.length || s.seats - s.gone.length < 2) return { ...s, idx: Math.min(idx, s.order.length - 1), phase: "over", word: null, choices: [] };
  const pool = WORDS.filter((w) => !s.used.includes(w));
  const choices = shuffle(pool.length >= 3 ? pool : WORDS, rng).slice(0, 3);
  return { ...s, idx, phase: "choose", choices, word: null, guessed: [], deadline: now + CHOOSE_MS };
}

function startDrawing(s: DrawState, word: string, now: number): DrawState {
  return { ...s, phase: "draw", word, choices: [], used: [...s.used, word], deadline: now + DRAW_MS, drawStartedAt: now, guessed: [] };
}

function endTurn(s: DrawState, now: number): DrawState {
  return { ...s, phase: "reveal", deadline: now + REVEAL_MS };
}

export const draw: Rules<DrawState, DrawMove, DrawView> = {
  init(seats, ctx) {
    const rounds = seats <= 4 ? 2 : 1;
    const order = Array.from({ length: rounds }, () => Array.from({ length: seats }, (_, i) => i)).flat();
    const base: DrawState = {
      seats,
      order,
      idx: 0,
      phase: "choose",
      choices: [],
      word: null,
      deadline: 0,
      drawStartedAt: 0,
      guessed: [],
      scores: Array(seats).fill(0),
      chat: [],
      gone: [],
      used: [],
    };
    return startTurn(base, 0, ctx.now, ctx.rng);
  },
  apply(s, seat, move, ctx) {
    if (s.phase === "over") return { error: "The game is over." };
    const drawer = drawerOf(s);
    if (move && "tick" in move) {
      if (ctx.now < s.deadline) return { error: "Not yet." };
      if (s.phase === "choose") return startDrawing(s, s.choices[0], ctx.now);
      if (s.phase === "draw") return endTurn(s, ctx.now);
      return startTurn(s, s.idx + 1, ctx.now, ctx.rng);
    }
    if (move && "choose" in move) {
      if (s.phase !== "choose" || seat !== drawer) return { error: "You can't pick a word now." };
      const word = s.choices[move.choose];
      if (!word) return { error: "Pick one of the words." };
      return startDrawing(s, word, ctx.now);
    }
    if (move && "guess" in move) {
      if (typeof move.guess !== "string") return { error: "Type a guess." };
      const text = move.guess.trim().slice(0, 60);
      if (!text) return { error: "Type a guess." };
      const chat = (entry: DrawChat) => [...s.chat, entry].slice(-40);
      // The drawer and people who've guessed can still chat, but can't score.
      if (s.phase !== "draw" || seat === drawer || s.guessed.includes(seat)) {
        if (s.phase === "draw" && (seat === drawer || s.guessed.includes(seat)) && norm(text).includes(norm(s.word ?? "@@"))) {
          return { error: "No spoilers!" };
        }
        return { ...s, chat: chat({ seat, text }) };
      }
      const g = norm(text);
      const w = norm(s.word!);
      if (g === w) {
        const left = Math.max(0, s.deadline - ctx.now) / DRAW_MS;
        const scores = [...s.scores];
        scores[seat] += 100 + Math.round(150 * left);
        scores[drawer] += 50;
        const guessed = [...s.guessed, seat];
        let next: DrawState = { ...s, scores, guessed, chat: chat({ seat, text: "", correct: true }) };
        const guessers = Array.from({ length: s.seats }, (_, i) => i).filter((i) => i !== drawer && !s.gone.includes(i));
        if (guessers.every((i) => guessed.includes(i))) next = endTurn(next, ctx.now);
        return next;
      }
      return { ...s, chat: chat({ seat, text, close: close(g, w) }) };
    }
    return { error: "Unknown move." };
  },
  view(s, seat) {
    const drawer = drawerOf(s);
    const knows = s.phase === "reveal" || s.phase === "over" || seat === drawer || (seat !== null && s.guessed.includes(seat));
    const word = s.word && knows ? s.word : null;
    const prev = s.used.length ? s.used[s.used.length - 1] : null;
    return {
      seats: s.seats,
      order: s.order,
      idx: s.idx,
      phase: s.phase,
      deadline: s.deadline,
      drawStartedAt: s.drawStartedAt,
      guessed: s.guessed,
      scores: s.scores,
      gone: s.gone,
      drawer,
      word,
      hint: s.word ? s.word.replace(/[a-z]/gi, "_") : "",
      choices: seat === drawer && s.phase === "choose" ? s.choices : [],
      // "close" is only shown to the person who typed it.
      chat: s.chat.map((c) => (c.close && c.seat !== seat ? { seat: c.seat, text: c.text } : c)),
      lastWord: s.phase === "reveal" || s.phase === "over" ? prev : null,
    };
  },
  status(s) {
    if (s.phase === "over") {
      const top = Math.max(...s.scores.filter((_, i) => !s.gone.includes(i)));
      return { over: true, winners: s.scores.flatMap((v, i) => (v === top && !s.gone.includes(i) ? [i] : [])) };
    }
    const drawer = drawerOf(s);
    if (s.phase === "choose") return { over: false, turn: [drawer] };
    return { over: false, turn: Array.from({ length: s.seats }, (_, i) => i).filter((i) => i !== drawer && !s.guessed.includes(i) && !s.gone.includes(i)) };
  },
  forfeit(s, seat, ctx) {
    const next = { ...s, gone: [...new Set([...s.gone, seat])] };
    if (drawerOf(s) === seat && (s.phase === "choose" || s.phase === "draw")) return startTurn(next, s.idx + 1, ctx.now, ctx.rng);
    return next.seats - next.gone.length < 2 ? { ...next, phase: "over" } : next;
  },
};
