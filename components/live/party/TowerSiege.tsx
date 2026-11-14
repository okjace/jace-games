"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { setupCanvas, themeColors } from "@/components/games/shared";
import { DEFAULT_MAP, type Rule, type TowerMap, type WhenKind } from "@/lib/live/maps";
import { Tabs, Toast, useReport, useSaved, type PartyProps } from "./shared";
import { drawMapBase } from "./towerMap";

/**
 * Tower Siege: answer questions to earn coins, build towers along the path,
 * then send the next wave. Waves only start when you press the button, so
 * answering never costs you a life. Score = waves cleared × 100 + defeats × 5
 * (your best run counts).
 */

const CELL = 40;

type Kind = "archer" | "cannon" | "frost" | "tesla" | "sniper" | "flame" | "venom" | "vortex" | "mine";
type TowerDef = {
  icon: string;
  name: string;
  blurb: string;
  cost: number;
  range: number;
  dmg: number;
  /** Seconds between shots. */
  rate: number;
  /** Hits everything this close to where the shot lands. */
  splash?: number;
  slow?: number;
  /** Lightning that jumps to this many enemies in all. */
  chain?: number;
  /** Aims for the toughest enemy in range instead of the one furthest along. */
  strong?: boolean;
  /** Hits every enemy in range at once. */
  aura?: boolean;
  /** Poison: damage per second for 3 seconds. */
  poison?: number;
  /** Knocks the target back this far along the road. */
  push?: number;
  /** Doesn't fight: coins per level each wave you clear. */
  mine?: number;
};
const TOWERS: Record<Kind, TowerDef> = {
  archer: { icon: "🏹", name: "Archer", blurb: "Quick arrows at the enemy furthest along.", cost: 15, range: 2.6, dmg: 1, rate: 0.55 },
  frost: { icon: "❄️", name: "Frost", blurb: "Slows enemies down.", cost: 25, range: 2.1, dmg: 0.3, rate: 0.8, slow: 0.5 },
  flame: { icon: "🔥", name: "Flamer", blurb: "Short range, but burns every enemy near it at once.", cost: 30, range: 1.5, dmg: 0.45, rate: 0.3, aura: true },
  venom: { icon: "☠️", name: "Venom", blurb: "Poisons enemies so they keep losing health.", cost: 30, range: 2.4, dmg: 0.2, rate: 0.9, poison: 1.2 },
  cannon: { icon: "💣", name: "Cannon", blurb: "Slow, heavy shots that hit a whole group.", cost: 35, range: 2.1, dmg: 3, rate: 1.4, splash: 0.9 },
  tesla: { icon: "⚡", name: "Tesla", blurb: "Lightning that jumps between up to 3 enemies.", cost: 40, range: 2.3, dmg: 1.6, rate: 1.0, chain: 3 },
  sniper: { icon: "🎯", name: "Sniper", blurb: "Huge range and big hits, aimed at the toughest enemy.", cost: 45, range: 5, dmg: 6, rate: 2.4, strong: true },
  vortex: { icon: "🌀", name: "Vortex", blurb: "Knocks enemies back along the road.", cost: 55, range: 2, dmg: 0.5, rate: 2.8, push: 1.2 },
  mine: { icon: "⛏️", name: "Gold Mine", blurb: "Doesn't fight. Earns 🪙4 per level every wave u clear.", cost: 50, range: 0, dmg: 0, rate: 0, mine: 4 },
};
type Tower = { x: number; y: number; kind: Kind; level: number };
type Enemy = {
  id: number;
  d: number;
  hp: number;
  max: number;
  speed: number;
  icon: string;
  slowUntil: number;
  /** last road square it stepped on (for traps and zones) */
  cell: number;
  poisonUntil: number;
  poison: number;
  /** reached the castle (not a defeat) */
  leaked?: boolean;
};
type Saved = { towers: Tower[]; spent: number; bonus: number; wave: number; best: number; kills: number; lives: number; started?: boolean };

const MAX_LIVES = 20;
let nextEnemyId = 0;
function makeEnemy(kind: "normal" | "fast" | "boss", wave: number): Enemy {
  const hp = (kind === "boss" ? 25 : kind === "fast" ? 2 : 4) * 1.22 ** (wave - 1);
  return { id: nextEnemyId++, d: 0, hp, max: hp, speed: kind === "boss" ? 0.8 : kind === "fast" ? 2.4 : 1.4, icon: kind === "boss" ? "🐲" : kind === "fast" ? "🦇" : "👾", slowUntil: 0, cell: -1, poisonUntil: 0, poison: 0 };
}

/** Does a rule fire for this event? */
function matches(r: Rule, when: WhenKind, n: number): boolean {
  if (r.when !== when) return false;
  if (when === "wave" || when === "cleared") return r.n === 0 || r.n === n;
  if (when === "zone") return r.n === n;
  if (when === "defeat") return n > 0 && n % r.n === 0;
  return true;
}

const upgradeCost = (t: Tower) => Math.round(TOWERS[t.kind].cost * 1.6 ** t.level);
const stat = (t: Tower) => {
  const b = TOWERS[t.kind];
  const up = 1.5 ** (t.level - 1);
  return { ...b, dmg: b.dmg * up, poison: b.poison ? b.poison * up : undefined, range: b.range ? b.range + (t.level - 1) * 0.3 : 0 };
};

function pointAt(PATH: [number, number][], d: number): [number, number] {
  const i = Math.min(PATH.length - 2, Math.floor(d));
  const f = Math.min(1, d - i);
  const [x1, y1] = PATH[i];
  const [x2, y2] = PATH[i + 1];
  return [(x1 + (x2 - x1) * f + 0.5) * CELL, (y1 + (y2 - y1) * f + 0.5) * CELL];
}

export function TowerSiege({ view, act, earn }: PartyProps) {
  const map = view.party.map ?? DEFAULT_MAP;
  const { cols: COLS, rows: ROWS, path: PATH } = map;
  const W = COLS * CELL;
  const H = ROWS * CELL;
  const onPath = new Set(PATH.map(([x, y]) => `${x},${y}`));
  const devices = map.devices ?? [];
  const mapRef = useRef(map);
  const [tab, setTab] = useState<"play" | "earn">("earn");
  const [saved, save] = useSaved<Saved>(view.code, "tower", () => ({ towers: [], spent: 0, bonus: 0, wave: 0, best: 0, kills: 0, lives: 10 }));
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<{ text: string; good: boolean; id: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef<{ enemies: Enemy[]; cooldowns: Map<string, number>; spawnLeft: number; nextSpawn: number; shots: { x1: number; y1: number; x2: number; y2: number; until: number; color?: string }[] }>({
    enemies: [],
    cooldowns: new Map(),
    spawnLeft: 0,
    nextSpawn: 0,
    shots: [],
  });
  const savedRef = useRef(saved);
  useEffect(() => {
    savedRef.current = saved;
    mapRef.current = map;
  }, [saved, map]);

  const wallet = (view.party.bank ?? 0) + saved.bonus - saved.spent;
  const score = saved.best;
  useReport(act, score);

  useEffect(() => {
    if (canvasRef.current) setupCanvas(canvasRef.current, W, H);
  }, [tab, W, H]);

  const say = useCallback((text: string, good = true) => setToast({ text, good, id: Date.now() }), []);

  // The map's rules: "when this happens, do that". Extra enemies sent between waves join the next one.
  const pendingSpawn = useRef<Enemy[]>([]);
  const fire = useCallback(
    (when: WhenKind, n: number) => {
      const rules = (mapRef.current.rules ?? []).filter((r) => matches(r, when, n));
      for (const r of rules) {
        if (r.then === "coins") {
          save((cur) => ({ ...cur, bonus: cur.bonus + r.amount }));
          say(`+${r.amount} coins`);
        } else if (r.then === "heal") save((cur) => ({ ...cur, lives: Math.min(MAX_LIVES, cur.lives + r.amount) }));
        else if (r.then === "hurt") save((cur) => ({ ...cur, lives: Math.max(0, cur.lives - r.amount) }));
        else if (r.then === "slow") {
          const until = performance.now() + r.amount * 1000;
          for (const e of live.current.enemies) e.slowUntil = Math.max(e.slowUntil, until);
        } else if (r.then === "spawn") {
          const wave = Math.max(1, savedRef.current.wave + 1);
          const extra = Array.from({ length: r.amount }, (_, i) => ({ ...makeEnemy(r.enemy ?? "normal", wave), d: -0.6 * i }));
          if (live.current.spawnLeft > 0 || live.current.enemies.length) live.current.enemies.push(...extra);
          else pendingSpawn.current.push(...extra);
        } else if (r.then === "message" && r.text) say(r.text);
      }
    },
    [save, say],
  );

  // "When the game starts" rules, once per game (the ref stops a second run before the save lands).
  const startFired = useRef(false);
  useEffect(() => {
    if (saved.started || startFired.current) return;
    startFired.current = true;
    save((cur) => ({ ...cur, started: true }));
    fire("start", 0);
  }, [saved.started, save, fire]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const sendWave = () => {
    const n = saved.wave + 1;
    live.current.spawnLeft = 6 + n * 2;
    live.current.nextSpawn = 0;
    live.current.enemies = pendingSpawn.current;
    pendingSpawn.current = [];
    // Coin wells pay out as each wave starts.
    const wells = devices.filter((d) => d.kind === "well").length;
    if (wells) save((cur) => ({ ...cur, bonus: cur.bonus + wells * 5 }));
    fire("wave", n);
    setRunning(true);
  };

  // The simulation (only while a wave is on). It runs on a timer rather
  // than animation frames, which stop when the page is hidden.
  useEffect(() => {
    if (!running) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    let last = performance.now();
    const n = savedRef.current.wave + 1;
    // Road squares with devices on them, by their place along the road.
    const roadDevices = new Map<number, { kind: string; channel?: number }>();
    const M0 = mapRef.current;
    for (const dev of M0.devices ?? []) {
      const i = M0.path.findIndex(([x, y]) => x === dev.x && y === dev.y);
      if (i >= 0) roadDevices.set(i, dev);
    }
    let defeats = savedRef.current.kills;
    const frame = (now: number, dt: number) => {
      const L = live.current;
      const M = mapRef.current;
      const PATH = M.path;
      const s = savedRef.current;
      // Spawn.
      L.nextSpawn -= dt;
      if (L.spawnLeft > 0 && L.nextSpawn <= 0) {
        L.spawnLeft--;
        L.nextSpawn = 0.8;
        const boss = n % 5 === 0 && L.spawnLeft === 0;
        const fast = !boss && Math.random() < Math.min(0.4, n * 0.04);
        L.enemies.push(makeEnemy(boss ? "boss" : fast ? "fast" : "normal", n));
      }
      // Move (mud halves speed), and set off traps and zones on each new road square.
      let leaked = 0;
      for (const e of L.enemies) {
        if (now < e.poisonUntil) e.hp -= e.poison * dt;
        const onMud = roadDevices.get(Math.max(0, Math.floor(e.d)))?.kind === "mud";
        e.d += e.speed * (now < e.slowUntil ? 0.5 : 1) * (onMud ? 0.5 : 1) * dt;
        const cell = Math.floor(e.d);
        if (cell > e.cell && cell >= 0) {
          for (let c = e.cell + 1; c <= cell; c++) {
            const dev = roadDevices.get(c);
            if (dev?.kind === "spikes") {
              e.hp -= 3 * 1.15 ** (n - 1);
            } else if (dev?.kind === "zone" && dev.channel) fire("zone", dev.channel);
          }
          e.cell = cell;
        }
        if (e.hp > 0 && e.d >= PATH.length - 1) {
          e.hp = 0;
          e.leaked = true;
          leaked++;
          fire("leak", 0);
        }
      }
      // Towers fire.
      const posOf = (e: Enemy) => pointAt(PATH, e.d);
      for (const t of s.towers) {
        if (TOWERS[t.kind].mine) continue;
        const key = `${t.x},${t.y}`;
        const cd = (L.cooldowns.get(key) ?? 0) - dt;
        if (cd > 0) {
          L.cooldowns.set(key, cd);
          continue;
        }
        const st = stat(t);
        const tx = (t.x + 0.5) * CELL;
        const ty = (t.y + 0.5) * CELL;
        const inRange = L.enemies.filter((e) => {
          if (e.hp <= 0) return false;
          const [ex, ey] = posOf(e);
          return Math.hypot(ex - tx, ey - ty) <= st.range * CELL;
        });
        const target = [...inRange].sort((a, b) => (st.strong ? b.hp - a.hp : b.d - a.d))[0];
        if (!target) {
          L.cooldowns.set(key, 0);
          continue;
        }
        L.cooldowns.set(key, st.rate);
        const [ex, ey] = posOf(target);
        const color = st.chain ? "#fde047" : st.poison ? "#a3e635" : st.aura ? "#fb923c" : st.push ? "#c084fc" : "#fff";
        let hit: Enemy[] = [target];
        if (st.aura) hit = inRange;
        else if (st.splash) hit = L.enemies.filter((e) => e.hp > 0 && Math.hypot(posOf(e)[0] - ex, posOf(e)[1] - ey) <= st.splash! * CELL);
        else if (st.chain) {
          // Lightning jumps to the nearest enemy it hasn't hit yet.
          while (hit.length < st.chain) {
            const [lx, ly] = posOf(hit[hit.length - 1]);
            const next = L.enemies
              .filter((e) => e.hp > 0 && !hit.includes(e))
              .map((e) => ({ e, dist: Math.hypot(posOf(e)[0] - lx, posOf(e)[1] - ly) }))
              .filter((x) => x.dist <= 1.8 * CELL)
              .sort((a, b) => a.dist - b.dist)[0];
            if (!next) break;
            hit.push(next.e);
          }
        }
        let from: [number, number] = [tx, ty];
        hit.forEach((e, i) => {
          const at = posOf(e);
          L.shots.push({ x1: from[0], y1: from[1], x2: at[0], y2: at[1], until: now + 140, color });
          if (st.chain) from = at;
          e.hp -= st.chain && i > 0 ? st.dmg * 0.7 : st.dmg;
          if (st.slow) e.slowUntil = now + 1500;
          if (st.poison) {
            e.poison = Math.max(e.poison, st.poison);
            e.poisonUntil = now + 3000;
          }
          if (st.push) e.d = Math.max(0, e.d - st.push);
        });
      }
      const killed = L.enemies.filter((e) => e.hp <= 0 && !e.leaked).length;
      L.enemies = L.enemies.filter((e) => e.hp > 0);
      L.shots = L.shots.filter((sh) => sh.until > now);
      for (let k = 0; k < killed; k++) fire("defeat", ++defeats);
      if (leaked || killed) {
        save((cur) => {
          const lives = Math.max(0, cur.lives - leaked);
          const kills = cur.kills + killed;
          return { ...cur, lives, kills, best: Math.max(cur.best, cur.wave * 100 + kills * 5) };
        });
      }
      draw(canvasRef.current, M, s, L, now);
      const sNow = savedRef.current;
      if (sNow.lives - leaked <= 0) {
        stop();
        setRunning(false);
        say("The castle fell! Rebuild and try again.", false);
        return;
      }
      if (L.spawnLeft === 0 && L.enemies.length === 0) {
        stop();
        setRunning(false);
        // Gold mines pay out for each wave cleared.
        const mined = savedRef.current.towers.reduce((a, t) => a + (TOWERS[t.kind].mine ?? 0) * t.level, 0);
        const bonus = 5 + n + mined;
        // Healing shrines restore a life for every wave cleared.
        const shrines = (M.devices ?? []).filter((d) => d.kind === "shrine").length;
        save((cur) => ({ ...cur, wave: n, bonus: cur.bonus + bonus, lives: Math.min(MAX_LIVES, cur.lives + shrines), best: Math.max(cur.best, n * 100 + cur.kills * 5) }));
        say(`Wave ${n} cleared! +${bonus} coins${mined ? ` (⛏️ ${mined})` : ""}${shrines ? ` · +${shrines} ❤️` : ""}`);
        fire("cleared", n);
      }
    };
    timer = setInterval(() => {
      // Catch up in small steps if the page was throttled (hidden tabs tick about once a second).
      const now = performance.now();
      let pending = Math.min(1.5, (now - last) / 1000);
      last = now;
      while (pending > 0 && timer) {
        const dt = Math.min(0.05, pending);
        pending -= dt;
        frame(now - pending * 1000, dt);
      }
    }, 33);
    return stop;
  }, [running, save, say, fire]);

  // Redraw when idle.
  useEffect(() => {
    if (!running) draw(canvasRef.current, map, saved, live.current, performance.now(), selected);
  }, [map, saved, running, tab, selected]);

  const tile = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * COLS);
    const y = Math.floor(((e.clientY - r.top) / r.height) * ROWS);
    const sign = devices.find((d) => d.x === x && d.y === y && d.kind === "sign");
    if (sign?.text) return say(`🪧 ${sign.text}`);
    if (onPath.has(`${x},${y}`) || map.decor.some((d) => d.x === x && d.y === y) || devices.some((d) => d.x === x && d.y === y)) return setSelected(null);
    setSelected({ x, y });
  };
  const here = selected ? saved.towers.find((t) => t.x === selected.x && t.y === selected.y) : null;

  const build = (kind: Kind) => {
    if (!selected || wallet < TOWERS[kind].cost) return say("Not enough coins. Answer questions to earn more!", false);
    save((cur) => ({ ...cur, spent: cur.spent + TOWERS[kind].cost, towers: [...cur.towers, { ...selected, kind, level: 1 }] }));
    setSelected(null);
    fire("build", 0);
  };
  const onBuild = (e: React.MouseEvent<HTMLButtonElement>) => build(e.currentTarget.dataset.kind as Kind);
  const upgrade = () => {
    if (!here) return;
    const cost = upgradeCost(here);
    if (wallet < cost) return say("Not enough coins.", false);
    save((cur) => ({ ...cur, spent: cur.spent + cost, towers: cur.towers.map((t) => (t === here || (t.x === here.x && t.y === here.y) ? { ...t, level: t.level + 1 } : t)) }));
  };
  const sell = () => {
    if (!here) return;
    save((cur) => ({ ...cur, spent: cur.spent - Math.floor(TOWERS[here.kind].cost / 2), towers: cur.towers.filter((t) => !(t.x === here.x && t.y === here.y)) }));
    setSelected(null);
  };
  const rebuild = () => save((cur) => ({ ...cur, lives: 10, wave: 0, kills: 0, towers: [], spent: cur.spent - Math.floor(cur.towers.reduce((a, t) => a + TOWERS[t.kind].cost, 0) / 2) }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-panel px-4 py-2 text-sm">
        <span>🪙 {wallet}</span>
        <span>🌊 Wave {saved.wave}</span>
        <span>❤️ {saved.lives}</span>
        <span className="font-semibold">🏰 {score}</span>
      </div>
      <Tabs tab={tab} setTab={setTab} earnBadge={wallet < 15 ? "!" : undefined} />
      {tab === "earn" ? (
        earn
      ) : (
        <>
          <canvas ref={canvasRef} onPointerDown={tile} style={{ aspectRatio: `${COLS} / ${ROWS}` }} className="touch-game w-full rounded-xl border border-line" aria-label="Tower Siege map. Tap an empty square to build." />
          {selected && !running && (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-panel p-3 text-sm">
              {here ? (
                <>
                  <span className="font-semibold">
                    {TOWERS[here.kind].icon} {TOWERS[here.kind].name} level {here.level}
                  </span>
                  <span className="w-full text-xs text-muted sm:order-last">{TOWERS[here.kind].blurb}</span>
                  <button type="button" onClick={upgrade} className="rounded-full bg-accent px-3 py-1.5 font-semibold text-on-accent">
                    Upgrade 🪙{upgradeCost(here)}
                  </button>
                  <button type="button" onClick={sell} className="rounded-full border border-line px-3 py-1.5">
                    Sell +🪙{Math.floor(TOWERS[here.kind].cost / 2)}
                  </button>
                </>
              ) : (
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
                  {(Object.keys(TOWERS) as Kind[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      data-kind={k}
                      onClick={onBuild}
                      disabled={wallet < TOWERS[k].cost}
                      className="flex flex-col items-start gap-0.5 rounded-xl border border-line px-3 py-2 text-left hover:border-accent disabled:opacity-40"
                    >
                      <span className="font-semibold">
                        {TOWERS[k].icon} {TOWERS[k].name} <span className="font-normal text-muted">🪙{TOWERS[k].cost}</span>
                      </span>
                      <span className="text-xs leading-snug text-muted">{TOWERS[k].blurb}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {saved.lives <= 0 ? (
            <button type="button" onClick={rebuild} className="h-12 rounded-full bg-accent font-bold text-on-accent">
              🔨 Rebuild (half your towers refunded)
            </button>
          ) : (
            <button type="button" onClick={sendWave} disabled={running || saved.towers.length === 0} className="h-12 rounded-full bg-accent font-bold text-on-accent disabled:opacity-50">
              {running ? "Wave incoming…" : saved.towers.length === 0 ? "Build a tower first" : `Send wave ${saved.wave + 1}`}
            </button>
          )}
        </>
      )}
      <Toast toast={toast} />
    </div>
  );
}

function draw(
  canvas: HTMLCanvasElement | null,
  map: TowerMap,
  s: Saved,
  L: { enemies: Enemy[]; shots: { x1: number; y1: number; x2: number; y2: number; color?: string }[] },
  now: number,
  selected: { x: number; y: number } | null = null,
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d")!;
  const c = themeColors();
  drawMapBase(ctx, map, CELL);
  if (selected) {
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeRect(selected.x * CELL + 2, selected.y * CELL + 2, CELL - 4, CELL - 4);
  }
  ctx.font = `${CELL * 0.7}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of s.towers) {
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc((t.x + 0.5) * CELL, (t.y + 0.5) * CELL, CELL * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(TOWERS[t.kind].icon, (t.x + 0.5) * CELL, (t.y + 0.5) * CELL);
    if (t.level > 1) {
      ctx.fillStyle = c.warn;
      ctx.font = `bold ${CELL * 0.3}px sans-serif`;
      ctx.fillText("★".repeat(Math.min(3, t.level - 1)), (t.x + 0.5) * CELL, (t.y + 0.95) * CELL);
      ctx.font = `${CELL * 0.7}px sans-serif`;
    }
  }
  ctx.lineWidth = 2;
  for (const sh of L.shots) {
    ctx.strokeStyle = sh.color ?? "#fff";
    ctx.beginPath();
    ctx.moveTo(sh.x1, sh.y1);
    ctx.lineTo(sh.x2, sh.y2);
    ctx.stroke();
  }
  for (const e of L.enemies) {
    const [x, y] = pointAt(map.path, e.d);
    ctx.font = `${CELL * 0.65}px sans-serif`;
    ctx.fillText(e.icon, x, y);
    ctx.fillStyle = "#000";
    ctx.fillRect(x - 14, y - 22, 28, 4);
    ctx.fillStyle = now < e.poisonUntil ? "#a3e635" : now < e.slowUntil ? "#38bdf8" : "#3ddc84";
    ctx.fillRect(x - 14, y - 22, 28 * Math.max(0, e.hp / e.max), 4);
  }
}
