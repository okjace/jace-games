"use client";

import { useEffect, useRef, useState } from "react";
import { STEAL_COST, VAULT_SYMBOLS, stackPos, type SkillView } from "@/lib/live/skillRules";
import { useJuice } from "../fx/Juice";
import { sfx } from "../fx/sfx";
import type { StageProps } from "./index";

/**
 * Stages for the six skill modes. Right answers (the question area under
 * each board) earn moves; the board is where you spend them. The server
 * decides every result; these screens show it and make it feel good.
 */

const panel = "rounded-3xl bg-black/25 p-4 backdrop-blur";

/** Runs `fn` once each time `key` changes (after the first render). */
function useOnChange(key: string, fn: () => void) {
  const seen = useRef(key);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (key === seen.current) return;
    seen.current = key;
    latest.current();
  }, [key]);
}

function Moves({ n, note }: { n: number; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`rounded-full px-3 py-1.5 text-sm font-black ${n > 0 ? "bg-white text-black" : "bg-black/30 text-white/80"}`} style={n > 0 ? { animation: "jg-bob 1.6s ease-in-out infinite" } : undefined}>
        ⚡ {n} move{n === 1 ? "" : "s"}
      </span>
      {note && <span className="text-right text-xs font-semibold text-white/80">{note}</span>}
    </div>
  );
}

/** Feedback for a move the server rejected (or nothing to do yet). */
function useMove(act: StageProps["act"]) {
  const juice = useJuice();
  return async (body: Record<string, unknown>) => {
    const v = await act({ action: "skill", ...body });
    if (!v) {
      sfx.wrong();
      juice.shake();
    }
    return v;
  };
}

/** Earned moves: a little pop so you notice. */
function useMovesPop(view: StageProps["view"]) {
  const juice = useJuice();
  useOnChange(`${view.me.answered}-${view.last?.kind}`, () => {
    if (view.last?.kind === "moves") {
      sfx.coin();
      juice.pop(`+${String(view.last.gain)} ⚡`, "#fde047");
    }
  });
}

function sk(view: StageProps["view"]): SkillView | null {
  return (view.party as { sk?: SkillView }).sk ?? null;
}

// ---------- Territory Wars ----------

export function TerritoryWars({ view, act, earn, busy }: StageProps) {
  const s = sk(view);
  const move = useMove(act);
  const juice = useJuice();
  useMovesPop(view);
  useOnChange(`${String(view.last?.kind)}-${String(view.last?.cell)}-${String(view.last?.by)}`, () => {
    if (view.last?.kind === "claim") {
      if (view.last.steal) {
        sfx.cash();
        juice.pop(`Stolen from ${String(view.last.from)}!`, "#fca5a5");
      } else sfx.tap();
    } else if (view.last?.kind === "stolen") {
      sfx.alarm();
      juice.flash("rgba(229,72,77,0.4)");
    }
  });
  const t = s?.territory;
  if (!s || !t) return earn;
  const me = t.players.findIndex((p) => p.you);
  const mine = (c: number) => t.cells[c] === me;
  const size = t.size;
  const near = (c: number) => {
    const x = c % size;
    const y = Math.floor(c / size);
    return [
      [x - 1, y],
      [x + 1, y],
      [x, y - 1],
      [x, y + 1],
    ].some(([a, b]) => a >= 0 && b >= 0 && a < size && b < size && mine(b * size + a));
  };
  const hasLand = t.cells.some((_, c) => mine(c));
  const safe = new Set(t.safe);
  const canClaim = (c: number) => !mine(c) && (!hasLand || near(c)) && !(t.cells[c] >= 0 && safe.has(c)) && s.moves >= (t.cells[c] >= 0 ? STEAL_COST : 1);
  return (
    <div className="flex flex-col gap-3">
      <div className={panel}>
        <Moves n={s.moves} note={hasLand ? `Claim next to your land · steal costs ${STEAL_COST}` : "Pick any free square to start"} />
        <div className="mt-3 grid gap-0.5 rounded-xl bg-black/30 p-1" style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
          {t.cells.map((o, c) => {
            const owner = o >= 0 ? t.players[o] : null;
            const ok = canClaim(c);
            return (
              <button
                key={c}
                type="button"
                disabled={!ok || busy}
                onClick={() => void move({ op: "claim", cell: c })}
                aria-label={`Square ${c + 1}${owner ? `, ${owner.name}'s` : ", free"}${ok ? ", claim it" : ""}`}
                className={`relative aspect-square rounded-[4px] transition-transform ${ok ? "cursor-pointer ring-2 ring-white/70 hover:scale-110" : ""}`}
                style={{ background: owner ? owner.color : "rgba(255,255,255,0.08)", opacity: owner && !owner.you ? 0.75 : 1 }}
              >
                {safe.has(c) && <span className="absolute inset-0 flex items-center justify-center text-[9px]">🛡️</span>}
                {owner?.you && !safe.has(c) && <span className="absolute inset-[30%] rounded-full bg-white/50" />}
              </button>
            );
          })}
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold">
          {[...t.players]
            .sort((a, b) => b.count - a.count)
            .map((p) => (
              <li key={p.name} className={`flex items-center gap-1 rounded-full px-2 py-1 ${p.you ? "bg-white/25" : "bg-black/25"}`}>
                <span className="h-3 w-3 rounded-sm" style={{ background: p.color }} />
                {p.name} {p.count}
              </li>
            ))}
        </ul>
      </div>
      {view.last?.kind === "stolen" && <p className="text-center text-sm font-bold text-red-200">{String(view.last.by)} stole one of your squares!</p>}
      {earn}
    </div>
  );
}

// ---------- Vault Cracker ----------

export function VaultCracker({ view, act, earn, busy }: StageProps) {
  const s = sk(view);
  const move = useMove(act);
  const juice = useJuice();
  const [pick, setPick] = useState<number[]>([]);
  useMovesPop(view);
  useOnChange(`${String(view.last?.kind)}-${s?.vault?.guesses.length}-${s?.vault?.cracked}`, () => {
    if (view.last?.kind === "cracked") {
      sfx.levelUp();
      juice.confetti(120);
      juice.pop(`+${String(view.last.points)} 🔓`, "#fde047");
    } else if (view.last?.kind === "vault-guess") sfx.tap();
  });
  const v = s?.vault;
  if (!s || !v) return earn;
  const full = pick.length === v.length;
  const submit = async () => {
    if (!full) return;
    const res = await move({ op: "crack", code: pick });
    if (res) setPick([]);
  };
  const cracked = view.last?.kind === "cracked" ? view.last : null;
  return (
    <div className="flex flex-col gap-3">
      <div className={panel}>
        <Moves n={s.moves} note={`${v.cracked} vault${v.cracked === 1 ? "" : "s"} cracked`} />
        {cracked && (
          <p className="mt-3 rounded-2xl bg-green-500/80 px-3 py-2 text-center text-sm font-black">
            🔓 Cracked in {String(cracked.guesses)}! The code was {(cracked.code as number[]).map((n) => VAULT_SYMBOLS[n]).join("")} · +{String(cracked.points)}
          </p>
        )}
        <ol className="mt-3 flex flex-col gap-1.5">
          {v.guesses.map((g, i) => (
            <li key={i} className="flex items-center justify-between rounded-xl bg-black/25 px-3 py-1.5">
              <span className="text-xl tracking-widest">{g.g.map((n) => VAULT_SYMBOLS[n]).join("")}</span>
              <span className="flex items-center gap-2 text-sm font-black" aria-label={`${g.exact} in the right spot, ${g.near} in the code but elsewhere`}>
                <span className="rounded-full bg-green-500 px-2 py-0.5">● {g.exact}</span>
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-black">○ {g.near}</span>
              </span>
            </li>
          ))}
          {v.guesses.length === 0 && <li className="text-center text-sm text-white/80">A new vault. 4 different symbols, in some order. Make ur first guess!</li>}
        </ol>
        <div className="mt-3 flex items-center justify-center gap-2">
          {Array.from({ length: v.length }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setPick((p) => p.filter((_, j) => j !== i))}
              aria-label={pick[i] !== undefined ? `Remove ${VAULT_SYMBOLS[pick[i]]}` : "Empty slot"}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-dashed border-white/50 bg-black/20 text-2xl"
            >
              {pick[i] !== undefined ? VAULT_SYMBOLS[pick[i]] : ""}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {VAULT_SYMBOLS.map((sym, n) => (
            <button
              key={n}
              type="button"
              disabled={pick.includes(n) || full}
              onClick={() => setPick((p) => [...p, n])}
              className="h-11 w-11 rounded-full bg-white/15 text-2xl disabled:opacity-30"
              aria-label={`Add ${sym}`}
            >
              {sym}
            </button>
          ))}
        </div>
        <button type="button" disabled={!full || busy || s.moves < 1} onClick={() => void submit()} className="mt-3 h-12 w-full rounded-full bg-white font-black text-black disabled:opacity-50">
          {s.moves < 1 ? "Answer a question for a guess" : full ? "🔐 Try this code (1 move)" : `Pick ${v.length - pick.length} more`}
        </button>
        <p className="mt-2 text-center text-xs text-white/70">● right symbol, right spot · ○ right symbol, wrong spot</p>
      </div>
      {earn}
    </div>
  );
}

// ---------- King of the Hill ----------

export function KingOfTheHill({ view, act, earn, busy }: StageProps) {
  const s = sk(view);
  const move = useMove(act);
  const juice = useJuice();
  useMovesPop(view);
  // The throne clock ticks on this screen between updates.
  const [tick, setTick] = useState(0);
  const got = useRef(0);
  const heldMs = s?.king?.heldMs ?? 0;
  useEffect(() => {
    got.current = Date.now();
    const t = setInterval(() => setTick(Date.now() - got.current), 250);
    return () => clearInterval(t);
  }, [heldMs]);
  useOnChange(`${String(view.last?.kind)}-${String(view.last?.shield)}-${String(view.last?.by)}`, () => {
    const k = view.last?.kind;
    if (k === "crowned") {
      sfx.levelUp();
      juice.confetti(100);
      juice.pop("👑 You're the king!", "#fde047");
    } else if (k === "attacked") {
      sfx.whoosh();
      juice.pop(`-${String(view.last?.hit)} 🛡️`, "#fca5a5");
    } else if (k === "fortified") sfx.coin();
    else if (k === "under-attack" || k === "cracked-shield") {
      sfx.alarm();
      juice.shake();
    } else if (k === "dethroned" || k === "fell") {
      sfx.wrong();
      juice.flash("rgba(229,72,77,0.45)");
    }
  });
  const k = s?.king;
  if (!s || !k) return earn;
  const king = k.king;
  const held = Math.floor((k.heldMs + tick) / 1000);
  return (
    <div className="flex flex-col gap-3">
      <div className={`${panel} flex flex-col items-center gap-3 text-center`}>
        <Moves n={s.moves} note={king?.you ? "Fortify to hold on" : "Attack to take the crown"} />
        <div className="relative flex h-40 w-full items-end justify-center overflow-hidden rounded-2xl bg-gradient-to-b from-sky-400/30 to-emerald-700/40">
          <div className="absolute bottom-0 h-16 w-3/4 rounded-t-[100%] bg-emerald-800/80" />
          <div className="relative mb-12 flex flex-col items-center" style={king ? { animation: "jg-bob 2s ease-in-out infinite" } : undefined}>
            <span className="text-5xl">{king ? "👑" : "🪑"}</span>
            <span className="mt-1 rounded-full bg-black/50 px-3 py-0.5 text-sm font-black">{king ? (king.you ? "You!" : king.name) : "Empty throne"}</span>
          </div>
        </div>
        {king && (
          <>
            <div className="flex gap-1" aria-label={`Shield ${king.shield} of ${k.maxShield}`}>
              {Array.from({ length: k.maxShield }, (_, i) => (
                <span key={i} className={`text-xl ${i < king.shield ? "" : "opacity-20 grayscale"}`}>
                  🛡️
                </span>
              ))}
            </div>
            <p className="font-mono text-sm font-bold">⏱ {held}s on the throne</p>
          </>
        )}
        {king?.you ? (
          <button type="button" disabled={busy || s.moves < 1} onClick={() => void move({ op: "fortify" })} className="h-14 w-full rounded-full bg-amber-300 text-lg font-black text-black shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-1 disabled:opacity-50">
            🛡️ Fortify (+1 shield)
          </button>
        ) : (
          <button type="button" disabled={busy || s.moves < 1} onClick={() => void move({ op: "attack" })} className="h-14 w-full rounded-full bg-red-500 text-lg font-black text-white shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-1 disabled:opacity-50">
            {king ? `⚔️ Attack ${king.name}${view.me.streak >= 3 ? " (×2 on a streak!)" : ""}` : "👑 Take the throne"}
          </button>
        )}
        <p className="text-xs text-white/70">Every second as king scores. Wrong answers crack the king&apos;s own shield.</p>
      </div>
      {earn}
    </div>
  );
}

// ---------- Memory Match ----------

export function MemoryMatch({ view, act, earn, busy }: StageProps) {
  const s = sk(view);
  const move = useMove(act);
  const juice = useJuice();
  useMovesPop(view);
  useOnChange(`${String(view.last?.kind)}-${view.me.score}-${s?.memory?.open.join(",")}`, () => {
    const k = view.last?.kind;
    if (k === "match") {
      sfx.correct();
      juice.pop(`+${String(view.last?.points)}${Number(view.last?.combo) > 1 ? ` · combo ×${String(view.last?.combo)}` : ""}`, "#86efac");
    } else if (k === "cleared") {
      sfx.levelUp();
      juice.confetti(140);
      juice.pop(`Board clear! +${String(view.last?.points)}`, "#fde047");
    } else if (k === "mismatch") sfx.wrong();
    else if (k === "flip") sfx.tap();
  });
  const m = s?.memory;
  if (!s || !m) return earn;
  const cols = m.faces.length <= 12 ? 4 : m.faces.length <= 16 ? 4 : 6;
  const midTurn = m.open.length === 1;
  return (
    <div className="flex flex-col gap-3">
      <div className={panel}>
        <Moves n={s.moves} note={`Board ${m.level} · ${m.pairs} pairs${m.combo > 0 ? ` · combo ×${m.combo}` : ""}`} />
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {m.faces.map((f, i) => {
            const up = f !== null;
            const canFlip = !up && (midTurn || s.moves > 0) && !busy;
            return (
              <button
                key={i}
                type="button"
                disabled={!canFlip}
                onClick={() => void move({ op: "flip", cell: i })}
                aria-label={up ? `Card ${i + 1}: ${f}` : `Card ${i + 1}, face down`}
                className={`flex aspect-square items-center justify-center rounded-xl text-3xl transition-transform duration-300 ${up ? "bg-white" : "bg-gradient-to-br from-indigo-400 to-fuchsia-500 hover:scale-105"} ${m.open.includes(i) ? "ring-4 ring-amber-300" : ""}`}
                style={{ transform: up ? "rotateY(0deg)" : "rotateY(180deg)" }}
              >
                <span style={{ transform: up ? undefined : "rotateY(180deg)" }}>{up ? f : "❔"}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-white/70">{midTurn ? "Now flip its partner!" : "Each turn flips two cards. A match keeps your turn going."}</p>
      </div>
      {earn}
    </div>
  );
}

// ---------- Minefield ----------

const NUM_COLORS = ["", "#60a5fa", "#4ade80", "#f87171", "#c084fc", "#fb923c", "#2dd4bf", "#f472b6", "#e5e5e5"];

export function Minefield({ view, act, earn, busy }: StageProps) {
  const s = sk(view);
  const move = useMove(act);
  const juice = useJuice();
  const [flagging, setFlagging] = useState(false);
  useMovesPop(view);
  useOnChange(`${String(view.last?.kind)}-${view.me.score}-${s?.sweep?.boards}-${s?.sweep?.flags.length}`, () => {
    const k = view.last?.kind;
    if (k === "boom") {
      sfx.alarm();
      juice.flash("rgba(239,68,68,0.6)");
      juice.shake();
    } else if (k === "swept") {
      sfx.levelUp();
      juice.confetti(140);
      juice.pop(`Field cleared! +${String(view.last?.bonus)}`, "#fde047");
    } else if (k === "opened") {
      sfx.tap();
      if (Number(view.last?.opened) > 4) juice.pop(`+${String(view.last?.opened)}`, "#86efac");
    }
  });
  const w = s?.sweep;
  if (!s || !w) return earn;
  const flags = new Set(w.flags);
  return (
    <div className="flex flex-col gap-3">
      <div className={panel}>
        <Moves n={s.moves} note={`💣 ${w.mines - w.flags.length} left · ${w.boards} cleared`} />
        {view.last?.kind === "boom" && <p className="mt-2 rounded-2xl bg-red-500/80 px-3 py-1.5 text-center text-sm font-black">💥 Boom! −{String(view.last.lost)} points. Fresh field.</p>}
        <div className="mt-3 grid gap-0.5 rounded-xl bg-black/40 p-1" style={{ gridTemplateColumns: `repeat(${w.size}, minmax(0, 1fr))` }}>
          {w.cells.map((n, c) => {
            const open = n !== null;
            const flagged = flags.has(c);
            return (
              <button
                key={c}
                type="button"
                disabled={open || busy || (!flagging && (flagged || s.moves < 1))}
                onClick={() => void move({ op: flagging ? "flag" : "reveal", cell: c })}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!open) void move({ op: "flag", cell: c });
                }}
                aria-label={open ? `${n} mines around` : flagged ? "Flagged" : "Closed square"}
                className={`flex aspect-square items-center justify-center rounded-[4px] text-sm font-black ${open ? "bg-white/10" : "bg-gradient-to-br from-slate-300 to-slate-500 hover:brightness-110"}`}
                style={open && n ? { color: NUM_COLORS[n] } : undefined}
              >
                {open ? n || "" : flagged ? "🚩" : ""}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" aria-pressed={!flagging} onClick={() => setFlagging(false)} className={`h-11 flex-1 rounded-full font-black ${!flagging ? "bg-white text-black" : "bg-black/30"}`}>
            ⛏️ Dig (1 move)
          </button>
          <button type="button" aria-pressed={flagging} onClick={() => setFlagging(true)} className={`h-11 flex-1 rounded-full font-black ${flagging ? "bg-white text-black" : "bg-black/30"}`}>
            🚩 Flag (free)
          </button>
        </div>
        <p className="mt-2 text-center text-xs text-white/70">Numbers count the mines touching a square. Ur first dig is always safe. Right-click flags too.</p>
      </div>
      {earn}
    </div>
  );
}

// ---------- Sky Stacker ----------

/** The animation clock (only read in effects and event handlers). */
const clock = () => performance.now();

export function SkyStacker({ view, act, earn, busy }: StageProps) {
  const s = sk(view);
  const move = useMove(act);
  const juice = useJuice();
  useMovesPop(view);
  const st = s?.stack;
  const block = st?.block ?? null;
  // Where the swinging block is, animated here from when the server sent it.
  const [x, setX] = useState(0);
  const received = useRef(0);
  const ageRef = useRef(0);
  useEffect(() => {
    if (!block) return;
    received.current = clock();
    ageRef.current = block.age;
    let raf = 0;
    const frame = () => {
      setX(stackPos(ageRef.current + clock() - received.current, block.width, block.period));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [block]);
  useOnChange(`${String(view.last?.kind)}-${view.me.score}-${st?.blocks.length}`, () => {
    const k = view.last?.kind;
    if (k === "stacked") {
      if (view.last?.perfect) {
        sfx.levelUp();
        juice.pop(`PERFECT +${String(view.last?.points)}`, "#fde047");
      } else {
        sfx.correct();
        juice.pop(`+${String(view.last?.points)}`, "#86efac");
      }
    } else if (k === "toppled") {
      sfx.wrong();
      juice.shake();
      juice.flash("rgba(229,72,77,0.4)");
    }
  });
  if (!s || !st) return earn;
  const dropIt = () => {
    if (!block) return;
    void move({ op: "drop", t: Math.round(ageRef.current + clock() - received.current) });
  };
  const shown = st.blocks.slice(-9);
  const base = st.blocks.length - shown.length;
  const hue = (i: number) => `hsl(${(i * 23) % 360} 85% 60%)`;
  return (
    <div className="flex flex-col gap-3">
      <div className={panel}>
        <Moves n={s.moves} note={`Height ${st.blocks.length} · best ${st.best}`} />
        <button
          type="button"
          onClick={dropIt}
          disabled={!block || busy}
          aria-label={block ? "Drop the block" : "Tower"}
          className="relative mt-3 block h-72 w-full overflow-hidden rounded-2xl bg-gradient-to-b from-sky-300/40 via-sky-500/20 to-transparent"
        >
          {/* The tower, newest on top; the ground scrolls away as it grows. */}
          {base === 0 && <div className="absolute inset-x-0 bottom-0 h-3 bg-emerald-700" />}
          {shown.map((b, i) => (
            <div
              key={base + i}
              className="absolute h-6 rounded-md border-b-4 border-black/25"
              style={{ left: `${b.x}%`, width: `${b.w}%`, bottom: `${12 + i * 24}px`, background: hue(base + i), animation: i === shown.length - 1 ? "jg-rise 0.25s ease-out" : undefined }}
            />
          ))}
          {block && <div className="absolute h-6 rounded-md border-b-4 border-black/25 shadow-lg" style={{ left: `${x}%`, width: `${block.width}%`, bottom: `${12 + shown.length * 24 + 18}px`, background: hue(st.blocks.length) }} />}
          {!block && st.blocks.length === 0 && <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/80">Get a block, then tap to drop it.</span>}
        </button>
        {view.last?.kind === "toppled" && <p className="mt-2 text-center text-sm font-bold text-red-200">Missed! Your {String(view.last.height)}-block tower came down (you keep your points).</p>}
        {block ? (
          <button type="button" onClick={dropIt} disabled={busy} className="mt-3 h-14 w-full rounded-full bg-white text-xl font-black text-black shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-1">
            ⬇️ DROP
          </button>
        ) : (
          <button type="button" onClick={() => void move({ op: "block" })} disabled={busy || s.moves < 1} className="mt-3 h-14 w-full rounded-full bg-amber-300 text-lg font-black text-black shadow-[0_6px_0_rgba(0,0,0,0.25)] active:translate-y-1 disabled:opacity-50">
            {s.moves < 1 ? "Answer a question for a block" : "🧱 Get a block (1 move)"}
          </button>
        )}
        <p className="mt-2 text-center text-xs text-white/70">Overhang gets cut off. A perfect drop keeps ur width (+10).</p>
      </div>
      {earn}
    </div>
  );
}
