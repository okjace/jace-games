"use client";

/**
 * Little synthesized sound effects for Live games (Web Audio, no files).
 * Every sound is a few oscillator notes with quick envelopes, so they load
 * instantly and stay tiny. Muting is remembered on this device.
 */

type Note = { f: number; t: number; d: number; type?: OscillatorType; v?: number; slide?: number };

const MUTE_KEY = "jace-games:live:muted";
let ctx: AudioContext | null = null;
let muted: boolean | null = null;

export function isMuted(): boolean {
  if (muted === null) {
    try {
      muted = localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      muted = false;
    }
  }
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {}
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function play(notes: Note[], gain = 0.18) {
  if (isMuted()) return;
  const ac = audio();
  if (!ac) return;
  const start = ac.currentTime + 0.01;
  for (const n of notes) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = n.type ?? "triangle";
    osc.frequency.setValueAtTime(n.f, start + n.t);
    if (n.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, n.f * n.slide), start + n.t + n.d);
    const v = (n.v ?? 1) * gain;
    g.gain.setValueAtTime(0.0001, start + n.t);
    g.gain.exponentialRampToValueAtTime(v, start + n.t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, start + n.t + n.d);
    osc.connect(g).connect(ac.destination);
    osc.start(start + n.t);
    osc.stop(start + n.t + n.d + 0.02);
  }
}

function noise(d: number, gain = 0.12, filter = 1200) {
  if (isMuted()) return;
  const ac = audio();
  if (!ac) return;
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * d), ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const f = ac.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = filter;
  const g = ac.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(ac.destination);
  src.start();
}

/** Short buzz on phones that support it. */
export function haptic(pattern: number | number[] = 15) {
  if (isMuted()) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

export const sfx = {
  correct: () => {
    play([
      { f: 660, t: 0, d: 0.12 },
      { f: 880, t: 0.08, d: 0.18 },
      { f: 1320, t: 0.16, d: 0.22, v: 0.6 },
    ]);
    haptic(20);
  },
  wrong: () => {
    play([
      { f: 220, t: 0, d: 0.18, type: "sawtooth", v: 0.6, slide: 0.7 },
      { f: 165, t: 0.12, d: 0.28, type: "sawtooth", v: 0.6, slide: 0.7 },
    ], 0.12);
    haptic([40, 40, 40]);
  },
  coin: () => play([{ f: 988, t: 0, d: 0.08, type: "square", v: 0.5 }, { f: 1319, t: 0.06, d: 0.2, type: "square", v: 0.5 }], 0.1),
  cash: () => play([0, 0.05, 0.1].map((t, i) => ({ f: 1047 + i * 220, t, d: 0.12, type: "square" as const, v: 0.4 })), 0.1),
  buy: () => play([{ f: 523, t: 0, d: 0.1 }, { f: 784, t: 0.07, d: 0.1 }, { f: 1047, t: 0.14, d: 0.2 }]),
  levelUp: () => play([523, 659, 784, 1047, 1319].map((f, i) => ({ f, t: i * 0.07, d: 0.16 }))),
  tap: () => play([{ f: 440, t: 0, d: 0.05, type: "square", v: 0.3 }], 0.1),
  tick: () => play([{ f: 1200, t: 0, d: 0.03, type: "square", v: 0.25 }], 0.08),
  countdown: () => play([{ f: 587, t: 0, d: 0.2 }]),
  go: () => play([{ f: 880, t: 0, d: 0.35 }, { f: 1175, t: 0, d: 0.35, v: 0.5 }]),
  whoosh: () => noise(0.3, 0.1, 2500),
  splash: () => {
    noise(0.45, 0.16, 900);
    haptic(30);
  },
  boom: () => {
    noise(0.5, 0.25, 500);
    play([{ f: 120, t: 0, d: 0.4, type: "sine", slide: 0.4 }], 0.3);
    haptic(60);
  },
  open: () => play([{ f: 392, t: 0, d: 0.1 }, { f: 523, t: 0.08, d: 0.1 }, { f: 659, t: 0.16, d: 0.1 }, { f: 1047, t: 0.24, d: 0.3 }]),
  hack: () => play(Array.from({ length: 6 }, (_, i) => ({ f: 300 + Math.random() * 900, t: i * 0.05, d: 0.05, type: "square" as const, v: 0.3 })), 0.08),
  alarm: () => {
    play([0, 0.25, 0.5].flatMap((t) => [{ f: 880, t, d: 0.12, type: "square" as const, v: 0.4 }, { f: 660, t: t + 0.12, d: 0.12, type: "square" as const, v: 0.4 }]), 0.1);
    haptic([80, 50, 80]);
  },
  streak: (n: number) => play([{ f: 440 * 2 ** (Math.min(n, 12) / 12), t: 0, d: 0.2 }, { f: 660 * 2 ** (Math.min(n, 12) / 12), t: 0.08, d: 0.25, v: 0.6 }]),
};
