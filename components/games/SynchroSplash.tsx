"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isMuted } from "@/components/live/fx/sfx";
import { GameOver, Overlay, Stats, beats, keyToDir, primaryButton, setupCanvas, useGameRandom, useKeys, type Dir, type GameProps } from "./shared";

/**
 * Synchro Splash: a call-and-response rhythm game in a pool. The lead
 * swimmer performs a phrase of moves on the beat; then it's your turn to
 * repeat it, on the beat, while the team follows you. Timing is judged
 * Perfect, Good or Miss. Phrases grow longer and the tempo climbs. A messy
 * phrase costs one of your three splashes; lose them all and the show's over.
 */

const W = 400;
const H = 520;
const WATER_Y = 250;
const DIRS: Dir[] = ["up", "right", "down", "left"];
const ARROW: Record<Dir, string> = { up: "↑", right: "→", down: "↓", left: "←" };
/** Each move has its own note (a C major chord, so any phrase sounds good). */
const NOTE: Record<Dir, number> = { up: 659.25, right: 783.99, down: 523.25, left: 440 };
const PERFECT_MS = 70;
const GOOD_MS = 150;
const LIVES = 3;
const START_BPM = 92;
const MAX_BPM = 152;
/** Bass notes for each bar: a I–V–vi–IV loop in C. */
const BASS = [130.81, 98, 110, 87.31];

type Judge = "perfect" | "good" | "miss";
type Pose = Dir | "idle";
type Drop = { x: number; y: number; vx: number; vy: number; life: number };
type Ripple = { x: number; y: number; r: number; life: number };

type Show = {
  t0: number;
  beatMs: number;
  /** Where the beat grid starts (ms since the show started); it moves when the tempo changes. */
  gridAt: number;
  /** When this phrase's first call beat lands (ms since the show started). */
  phraseAt: number;
  phrase: Dir[];
  judged: (Judge | null)[];
  phraseNo: number;
  score: number;
  combo: number;
  bestCombo: number;
  lives: number;
  leader: { pose: Pose; at: number };
  team: { pose: Pose; at: number };
  drops: Drop[];
  ripples: Ripple[];
  lastBeat: number;
  callBeat: number;
  flash: { text: string; color: string; at: number } | null;
  over: boolean;
};

const len = (phraseNo: number) => Math.min(8, 3 + Math.floor(phraseNo / 2));
const bpm = (phraseNo: number) => Math.min(MAX_BPM, START_BPM + phraseNo * 4);
const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 8));
/** Beats in one phrase: the call, a breath, your answer, a breath. */
const phraseBeats = (n: number) => n * 2 + 2;

// ---------- Sound (Web Audio, made on the fly) ----------

let actx: AudioContext | null = null;
function ac(): AudioContext | null {
  if (typeof window === "undefined" || isMuted()) return null;
  try {
    actx ??= new AudioContext();
    if (actx.state === "suspended") void actx.resume();
    return actx;
  } catch {
    return null;
  }
}
function tone(f: number, d: number, type: OscillatorType = "triangle", v = 0.18, slide?: number) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  const t = a.currentTime;
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(f * slide, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + d + 0.02);
}
function hat(v = 0.05) {
  const a = ac();
  if (!a) return;
  const buf = a.createBuffer(1, a.sampleRate * 0.05, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  src.buffer = buf;
  f.type = "highpass";
  f.frequency.value = 7000;
  g.gain.value = v;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
}
const sound = {
  kick: () => tone(120, 0.18, "sine", 0.35, 0.35),
  bass: (f: number) => tone(f, 0.32, "sawtooth", 0.05),
  move: (d: Dir, v = 0.16) => tone(NOTE[d], 0.22, "triangle", v),
  perfect: (d: Dir) => {
    tone(NOTE[d], 0.25, "triangle", 0.18);
    tone(NOTE[d] * 2, 0.18, "sine", 0.06);
  },
  miss: () => tone(160, 0.25, "square", 0.06, 0.6),
  splash: () => {
    hat(0.25);
    tone(300, 0.3, "sine", 0.1, 0.4);
  },
  cheer: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.18, "triangle", 0.14), i * 70)),
};

// ---------- Drawing ----------

const easeOut = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

/** Arm angles (radians, 0 = right, down is positive) for each pose. */
const ARMS: Record<Pose, [number, number]> = {
  idle: [Math.PI * 0.82, Math.PI * 0.18],
  up: [-Math.PI * 0.62, -Math.PI * 0.38],
  down: [Math.PI * 0.6, Math.PI * 0.4],
  left: [Math.PI * 1.02, Math.PI * 0.9],
  right: [Math.PI * 0.1, -Math.PI * 0.02],
};

function drawSwimmer(ctx: CanvasRenderingContext2D, x: number, scale: number, pose: { pose: Pose; at: number }, now: number, cap: string, beatMs: number) {
  const k = easeOut((now - pose.at) / 120);
  // Moves hold for a moment, then ease back to sculling.
  const holding = now - pose.at < beatMs * 0.7;
  const target = holding ? pose.pose : "idle";
  const sway = Math.sin(now / 260 + x) * 0.18;
  const [la, ra] = ARMS[target].map((a, i) => {
    const idle = ARMS.idle[i] + (i ? -sway : sway);
    return target === "idle" ? idle : idle + (a - idle) * k;
  });
  const bob = Math.sin(now / 400 + x / 40) * 3;
  // "Down" is a ballet leg: head dips, one leg rises out of the water.
  const dip = target === "down" ? 18 * k : 0;
  const y = WATER_Y - 22 * scale + bob + dip;
  ctx.save();
  ctx.lineCap = "round";
  if (target === "down") {
    ctx.strokeStyle = "#fde2c4";
    ctx.lineWidth = 7 * scale;
    ctx.beginPath();
    ctx.moveTo(x + 6 * scale, WATER_Y + 4);
    ctx.lineTo(x + 6 * scale, WATER_Y - 58 * scale * k);
    ctx.stroke();
    ctx.fillStyle = "#fde2c4";
    ctx.beginPath();
    ctx.ellipse(x + 9 * scale, WATER_Y - 60 * scale * k, 5 * scale, 3 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Arms (drawn first so the body sits on top).
  ctx.strokeStyle = "#fde2c4";
  ctx.lineWidth = 5 * scale;
  for (const [a, side] of [
    [la, -1],
    [ra, 1],
  ] as const) {
    const sx = x + side * 9 * scale;
    const sy = y + 10 * scale;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a) * 26 * scale, sy + Math.sin(a) * 26 * scale);
    ctx.stroke();
  }
  // Body and suit.
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.roundRect(x - 10 * scale, y + 6 * scale, 20 * scale, 22 * scale, 8 * scale);
  ctx.fill();
  // Head, cap and goggles.
  ctx.fillStyle = "#fde2c4";
  ctx.beginPath();
  ctx.arc(x, y, 10 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cap;
  ctx.beginPath();
  ctx.arc(x, y - 1 * scale, 10.5 * scale, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(x - 7 * scale, y + 1 * scale, 5 * scale, 3 * scale);
  ctx.fillRect(x + 2 * scale, y + 1 * scale, 5 * scale, 3 * scale);
  ctx.restore();
}

function draw(ctx: CanvasRenderingContext2D, s: Show, now: number, phase: "idle" | "running" | "over") {
  const t = now - s.t0;
  // Sky and stands.
  const sky = ctx.createLinearGradient(0, 0, 0, WATER_Y);
  sky.addColorStop(0, "#1e1b4b");
  sky.addColorStop(1, "#7c3aed");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, WATER_Y);
  // Spotlights sweep with the music.
  const beat = s.beatMs ? ((((t - s.gridAt) / s.beatMs) % 1) + 1) % 1 : 0;
  for (let i = 0; i < 3; i++) {
    const cx = 60 + i * 140;
    const swing = Math.sin(t / 900 + i * 2) * 60;
    const grad = ctx.createLinearGradient(cx, 0, cx + swing, WATER_Y);
    grad.addColorStop(0, `rgba(255,255,255,${0.16 + (1 - beat) * 0.08})`);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - 6, 0);
    ctx.lineTo(cx + 6, 0);
    ctx.lineTo(cx + swing + 60, WATER_Y);
    ctx.lineTo(cx + swing - 60, WATER_Y);
    ctx.fill();
  }
  // A crowd of tiny dots that bounce on the beat.
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % W;
    const y = 30 + ((i * 53) % 90) - (phase === "running" ? (1 - beat) * 3 * ((i % 3) + 1) : 0);
    ctx.fillStyle = ["#f472b6", "#facc15", "#38bdf8", "#a3e635"][i % 4];
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The pool, with light rippling across it.
  const water = ctx.createLinearGradient(0, WATER_Y, 0, H);
  water.addColorStop(0, "#22d3ee");
  water.addColorStop(1, "#0e7490");
  ctx.fillStyle = water;
  ctx.fillRect(0, WATER_Y, W, H - WATER_Y);
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  for (let row = 0; row < 7; row++) {
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) {
      const y = WATER_Y + 20 + row * 34 + Math.sin(x / 30 + t / 500 + row) * 4;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Ripples.
  for (const r of s.ripples) {
    ctx.strokeStyle = `rgba(255,255,255,${r.life})`;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.r, r.r * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // The team: the leader in the middle, everyone else follows you.
  const team = [70, 140, 260, 330];
  const caps = ["#f43f5e", "#f97316", "#a855f7", "#14b8a6"];
  team.forEach((x, i) => drawSwimmer(ctx, x, 0.95, s.team, now - i * 30, caps[i], s.beatMs || 600));
  drawSwimmer(ctx, 200, 1.2, s.leader, now, "#facc15", s.beatMs || 600);
  // Water over their middles.
  ctx.fillStyle = "rgba(34,211,238,0.55)";
  ctx.fillRect(0, WATER_Y, W, 14);
  // Splash drops.
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  for (const d of s.drops) {
    ctx.globalAlpha = d.life;
    ctx.beginPath();
    ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // The phrase track.
  if (s.phrase.length && phase === "running") {
    const n = s.phrase.length;
    const size = Math.min(42, (W - 40) / n - 6);
    const x0 = (W - n * (size + 6)) / 2;
    const y0 = H - size - 24;
    const callEnd = s.phraseAt + n * s.beatMs;
    const answering = t >= callEnd;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (size + 6);
      const shown = t >= s.phraseAt + i * s.beatMs - 40;
      const j = s.judged[i];
      ctx.fillStyle = j === "perfect" ? "#facc15" : j === "good" ? "#4ade80" : j === "miss" ? "#ef4444" : "rgba(15,23,42,0.55)";
      ctx.beginPath();
      ctx.roundRect(x, y0, size, size, 10);
      ctx.fill();
      // The next beat to hit glows.
      const next = answering && s.judged.findIndex((v) => v === null) === i;
      if (next) {
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      if (shown) {
        ctx.fillStyle = j ? "#0f172a" : "#fff";
        ctx.font = `bold ${size * 0.6}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ARROW[s.phrase[i]], x + size / 2, y0 + size / 2 + 1);
      }
    }
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(answering ? "Your turn!" : t < s.phraseAt ? "Get ready…" : "Watch the leader…", W / 2, y0 - 14);
  }
  // Beat pulse.
  if (phase === "running") {
    ctx.strokeStyle = `rgba(250,204,21,${1 - beat})`;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(W - 26, 26, 10 + beat * 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Judgement text.
  if (s.flash && now - s.flash.at < 600) {
    const a = 1 - (now - s.flash.at) / 600;
    ctx.globalAlpha = a;
    ctx.fillStyle = s.flash.color;
    ctx.font = `900 ${30 + (1 - a) * 8}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(s.flash.text, W / 2, 205 - (1 - a) * 20);
    ctx.globalAlpha = 1;
  }
}

export default function SynchroSplash({ onFinish, best, seed, onProgress }: GameProps) {
  const rand = useGameRandom(seed);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"idle" | "running" | "over">("idle");
  const [hud, setHud] = useState({ score: 0, combo: 0, lives: LIVES, phrase: 0, bestCombo: 0 });
  const [wasBest, setWasBest] = useState(false);
  const show = useRef<Show>({
    t0: 0,
    beatMs: 0,
    gridAt: 0,
    phraseAt: 0,
    phrase: [],
    judged: [],
    phraseNo: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    lives: LIVES,
    leader: { pose: "idle", at: 0 },
    team: { pose: "idle", at: 0 },
    drops: [],
    ripples: [],
    lastBeat: -1,
    callBeat: -1,
    flash: null,
    over: false,
  });

  const newPhrase = useCallback(
    (s: Show, at: number) => {
      const n = len(s.phraseNo);
      // No move three times in a row, so phrases have shape.
      const phrase: Dir[] = [];
      while (phrase.length < n) {
        const d = DIRS[Math.floor(rand() * 4)];
        if (phrase.length >= 2 && phrase[phrase.length - 1] === d && phrase[phrase.length - 2] === d) continue;
        phrase.push(d);
      }
      s.phrase = phrase;
      s.judged = new Array(n).fill(null);
      s.beatMs = 60_000 / bpm(s.phraseNo);
      s.phraseAt = at;
      s.callBeat = -1;
    },
    [rand],
  );

  const splashAt = (s: Show, x: number, n = 10) => {
    for (let i = 0; i < n; i++) s.drops.push({ x: x + (Math.random() - 0.5) * 20, y: WATER_Y, vx: (Math.random() - 0.5) * 160, vy: -120 - Math.random() * 220, life: 1 });
    s.ripples.push({ x, y: WATER_Y + 8, r: 8, life: 0.8 });
  };

  const start = useCallback(() => {
    rand.reset();
    const s = show.current;
    Object.assign(s, { t0: performance.now(), gridAt: 0, score: 0, combo: 0, bestCombo: 0, lives: LIVES, phraseNo: 0, drops: [], ripples: [], lastBeat: -1, flash: null, over: false });
    s.leader = { pose: "idle", at: 0 };
    s.team = { pose: "idle", at: 0 };
    // A four-beat count-in before the first phrase.
    newPhrase(s, (60_000 / bpm(0)) * 4);
    setHud({ score: 0, combo: 0, lives: LIVES, phrase: 1, bestCombo: 0 });
    setPhase("running");
  }, [rand, newPhrase]);

  const finish = useCallback(() => {
    const s = show.current;
    s.over = true;
    setHud((h) => ({ ...h, score: s.score, lives: 0, bestCombo: s.bestCombo }));
    setWasBest(s.score > 0 && beats(s.score, best, "higher"));
    setPhase("over");
    onFinish(s.score, performance.now() - s.t0);
  }, [best, onFinish]);

  const judge = useCallback((s: Show, i: number, result: Judge, now: number) => {
    s.judged[i] = result;
    if (result === "miss") {
      s.combo = 0;
      s.flash = { text: "MISS", color: "#f87171", at: now };
      sound.miss();
    } else {
      s.combo++;
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      s.score += (result === "perfect" ? 100 : 50) * multiplier(s.combo);
      s.flash = result === "perfect" ? { text: "PERFECT!", color: "#facc15", at: now } : { text: "GOOD", color: "#4ade80", at: now };
      s.team = { pose: s.phrase[i], at: now };
      [70, 140, 260, 330].forEach((x) => splashAt(s, x, 4));
    }
  }, []);

  // The show: beats, the leader's call, judging your answers.
  useEffect(() => {
    if (phase !== "running") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, W, H);
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const s = show.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now - s.t0;
      // The beat: kick on every beat, hi-hat between, bass at the start of each bar.
      const beatNo = Math.floor((t - s.gridAt) / s.beatMs);
      if (beatNo !== s.lastBeat) {
        s.lastBeat = beatNo;
        sound.kick();
        if (((beatNo % 4) + 4) % 4 === 0) sound.bass(BASS[((Math.floor(beatNo / 4) % 4) + 4) % 4]);
        setTimeout(() => hat(), s.beatMs / 2);
      }
      const n = s.phrase.length;
      // The leader's call.
      const callIdx = Math.floor((t - s.phraseAt) / s.beatMs);
      if (callIdx >= 0 && callIdx < n && callIdx !== s.callBeat) {
        s.callBeat = callIdx;
        const d = s.phrase[callIdx];
        s.leader = { pose: d, at: now };
        sound.move(d);
        splashAt(s, 200, 8);
      }
      // Answers you didn't make in time are misses.
      const answerAt = s.phraseAt + (n + 1) * s.beatMs;
      for (let i = 0; i < n; i++) {
        if (s.judged[i] === null && t > answerAt + i * s.beatMs + Math.min(GOOD_MS, s.beatMs / 2)) judge(s, i, "miss", now);
      }
      // The phrase is over: score it, and on to the next (or the end of the show).
      const endAt = s.phraseAt + phraseBeats(n) * s.beatMs;
      if (t >= endAt) {
        const misses = s.judged.filter((j) => j === "miss").length;
        const clean = misses === 0;
        if (clean) {
          const bonus = 50 * n * multiplier(s.combo);
          s.score += bonus;
          s.flash = { text: s.judged.every((j) => j === "perfect") ? `FLAWLESS +${bonus}` : `NICE +${bonus}`, color: "#f0abfc", at: now };
          sound.cheer();
        } else if (misses >= Math.max(2, Math.ceil(n / 3))) {
          s.lives--;
          s.flash = { text: "SPLASH! −1", color: "#f87171", at: now };
          sound.splash();
          for (const x of [70, 140, 200, 260, 330]) splashAt(s, x, 14);
        }
        if (s.lives <= 0) {
          draw(ctx, s, now, "running");
          finish();
          return;
        }
        s.phraseNo++;
        // The next phrase starts one beat (of the new tempo) from now, and the music's beat grid follows it.
        newPhrase(s, t + 60_000 / bpm(s.phraseNo));
        s.gridAt = s.phraseAt;
        s.lastBeat = Math.floor((t - s.gridAt) / s.beatMs);
        setHud({ score: s.score, combo: s.combo, lives: s.lives, phrase: s.phraseNo + 1, bestCombo: s.bestCombo });
        onProgress?.(s.score);
      }
      // Drops and ripples.
      for (const d of s.drops) {
        d.vy += 600 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt * 1.2;
      }
      s.drops = s.drops.filter((d) => d.life > 0 && d.y < WATER_Y + 30);
      for (const r of s.ripples) {
        r.r += 60 * dt;
        r.life -= dt * 0.9;
      }
      s.ripples = s.ripples.filter((r) => r.life > 0);
      draw(ctx, s, now, "running");
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase, newPhrase, judge, finish, onProgress]);

  // The idle screen still shows the pool.
  useEffect(() => {
    if (phase === "running") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas, W, H);
    let raf = 0;
    const frame = (now: number) => {
      draw(ctx, show.current, now, phase);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const press = useCallback(
    (d: Dir) => {
      const s = show.current;
      if (phase !== "running" || s.over) return;
      const now = performance.now();
      const t = now - s.t0;
      const n = s.phrase.length;
      const answerAt = s.phraseAt + (n + 1) * s.beatMs;
      const i = s.judged.findIndex((j) => j === null);
      sound.move(d, 0.1);
      if (i < 0 || t < answerAt - s.beatMs / 2) {
        // Too early: still the leader's turn.
        if (t >= s.phraseAt && t < answerAt - s.beatMs / 2) s.flash = { text: "Wait for it…", color: "#e0f2fe", at: now };
        return;
      }
      const off = Math.abs(t - (answerAt + i * s.beatMs));
      if (off > s.beatMs / 2) return;
      if (d !== s.phrase[i] || off > GOOD_MS) judge(s, i, "miss", now);
      else {
        judge(s, i, off <= PERFECT_MS ? "perfect" : "good", now);
        if (off <= PERFECT_MS) sound.perfect(d);
      }
      setHud((h) => ({ ...h, score: s.score, combo: s.combo }));
    },
    [phase, judge],
  );

  useKeys((e) => {
    const d = keyToDir(e.key);
    if (d) {
      e.preventDefault();
      if (!e.repeat) press(d);
    } else if ((e.key === "Enter" || e.key === " ") && phase !== "running") {
      e.preventDefault();
      start();
    }
  });

  const pad = "flex h-16 flex-1 items-center justify-center rounded-2xl text-3xl font-black text-white shadow-[0_5px_0_rgba(0,0,0,0.25)] active:translate-y-1 active:shadow-none select-none";
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full max-w-[400px] items-center justify-between gap-2">
        <Stats
          items={[
            { label: "Score", value: hud.score.toLocaleString("en-US") },
            { label: "Combo", value: `${hud.combo} ×${multiplier(hud.combo)}`, accent: hud.combo >= 8 },
            { label: "Splashes", value: "💧".repeat(hud.lives) || "—" },
          ]}
        />
      </div>
      <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}`, maxWidth: `min(${W}px, calc(64vh * ${W / H}))` }}>
        <canvas ref={canvasRef} className="h-full w-full rounded-2xl border border-line shadow-xl" aria-label="Synchro Splash pool. Watch the leader's moves, then repeat them on the beat with the arrow keys." />
        {phase === "idle" && (
          <Overlay>
            <p className="text-3xl">🏊‍♀️🎶</p>
            <p className="font-semibold">Synchro Splash</p>
            <p className="text-sm text-muted">The leader shows a routine on the beat. Then it&apos;s your turn: repeat it in time with the arrow keys (or the pads). Sound on!</p>
            <button type="button" onClick={start} className={primaryButton}>
              Start the show
            </button>
          </Overlay>
        )}
        {phase === "over" && <GameOver title="The show's over" score={`${hud.score.toLocaleString("en-US")}`} isBest={wasBest} onAgain={start} extra={<p className="text-sm text-muted">Reached phrase {hud.phrase} · best combo {hud.bestCombo}</p>} />}
      </div>
      <div className="touch-game flex w-full max-w-[400px] gap-2" aria-hidden="true">
        {(["left", "up", "down", "right"] as Dir[]).map((d) => (
          <button
            key={d}
            type="button"
            tabIndex={-1}
            onPointerDown={(e) => {
              e.preventDefault();
              press(d);
            }}
            className={pad}
            style={{ background: d === "up" ? "#f43f5e" : d === "right" ? "#14b8a6" : d === "down" ? "#a855f7" : "#f97316" }}
          >
            {ARROW[d]}
          </button>
        ))}
      </div>
    </div>
  );
}
