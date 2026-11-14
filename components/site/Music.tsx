"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getAudio, useAudio } from "@/lib/audioSettings";
import type { SeasonId } from "@/lib/seasons";

/**
 * Background music for all of Jace Live, made on the fly with Web Audio (no
 * files): soft pads, a bass line and a wandering melody over a four-chord
 * loop in the theme's mood. On game pages (playing, hosting) it switches to
 * a faster track with drums and an arpeggio. It starts after the first click
 * or key press (browsers don't allow sound before that), follows the Music
 * slider, and goes quiet while the tab is hidden.
 */

type Mood = { key: number; minor: boolean; bpm: number; bell: boolean };

const MOODS: Partial<Record<SeasonId, Mood>> = {
  fall: { key: 0, minor: false, bpm: 84, bell: false },
  halloween: { key: -3, minor: true, bpm: 78, bell: false },
  thanksgiving: { key: 2, minor: false, bpm: 86, bell: false },
  christmas: { key: 5, minor: false, bpm: 96, bell: true },
  winter: { key: 3, minor: false, bpm: 80, bell: true },
  newyear: { key: 7, minor: false, bpm: 112, bell: true },
  lunar: { key: 2, minor: false, bpm: 92, bell: true },
  valentines: { key: 5, minor: false, bpm: 82, bell: false },
  stpatricks: { key: 2, minor: false, bpm: 108, bell: false },
  spring: { key: 7, minor: false, bpm: 92, bell: false },
  easter: { key: 5, minor: false, bpm: 94, bell: true },
  earth: { key: 0, minor: false, bpm: 88, bell: false },
  summer: { key: 9, minor: false, bpm: 104, bell: false },
  july4: { key: 7, minor: false, bpm: 112, bell: false },
  school: { key: 0, minor: false, bpm: 96, bell: false },
  space: { key: -1, minor: true, bpm: 76, bell: true },
  ocean: { key: 4, minor: false, bpm: 78, bell: true },
  candy: { key: 7, minor: false, bpm: 110, bell: true },
  neon: { key: -2, minor: true, bpm: 116, bell: false },
  retro: { key: 0, minor: false, bpm: 120, bell: false },
};
const DEFAULT_MOOD: Mood = { key: 0, minor: false, bpm: 90, bell: false };

// Chord roots (scale degrees) for the loop: I–V–vi–IV in major, i–VI–III–VII in minor.
const MAJOR_LOOP = [0, 7, 9, 5];
const MINOR_LOOP = [0, 8, 3, 10];
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];

const hz = (semitonesFromC4: number) => 261.63 * 2 ** (semitonesFromC4 / 12);

export function Music({ season }: { season: SeasonId }) {
  const pathname = usePathname();
  const { music } = useAudio();
  const game = pathname.startsWith("/live/play/") || (pathname.startsWith("/live/host/") && pathname !== "/live/host/new");
  const engine = useRef<{ ctx: AudioContext; master: GainNode; timer: ReturnType<typeof setInterval> | null; next: number; step: number } | null>(null);
  const settings = useRef({ season, game });
  useEffect(() => {
    settings.current = { season, game };
  }, [season, game]);

  // Follow the Music slider.
  useEffect(() => {
    const e = engine.current;
    if (e) e.master.gain.setTargetAtTime(music * 1.4, e.ctx.currentTime, 0.2);
  }, [music]);

  useEffect(() => {
    const start = () => {
      if (engine.current || getAudio().music === 0) return;
      let ctx: AudioContext;
      try {
        ctx = new AudioContext();
      } catch {
        return;
      }
      const master = ctx.createGain();
      master.gain.value = 0;
      master.gain.setTargetAtTime(getAudio().music * 1.4, ctx.currentTime, 1.5);
      // A touch of echo makes the synths feel less plasticky.
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.28;
      const fb = ctx.createGain();
      fb.gain.value = 0.22;
      delay.connect(fb).connect(delay);
      const wet = ctx.createGain();
      wet.gain.value = 0.25;
      delay.connect(wet).connect(master);
      // A limiter so it can be loud without crackling.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 8;
      master.connect(limiter).connect(ctx.destination);
      const e = { ctx, master, timer: null as ReturnType<typeof setInterval> | null, next: ctx.currentTime + 0.2, step: 0 };
      engine.current = e;

      const voice = (f: number, t: number, d: number, type: OscillatorType, v: number, echo = false) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(v, t + Math.min(0.08, d * 0.2));
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(master);
        if (echo) g.connect(delay);
        o.start(t);
        o.stop(t + d + 0.05);
      };
      const drum = (t: number, kind: "kick" | "hat" | "snare") => {
        if (kind === "kick") {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.setValueAtTime(140, t);
          o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
          g.gain.setValueAtTime(0.5, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
          o.connect(g).connect(master);
          o.start(t);
          o.stop(t + 0.2);
          return;
        }
        const len = kind === "hat" ? 0.04 : 0.12;
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        const src = ctx.createBufferSource();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        src.buffer = buf;
        f.type = kind === "hat" ? "highpass" : "bandpass";
        f.frequency.value = kind === "hat" ? 8000 : 1800;
        g.gain.value = kind === "hat" ? 0.08 : 0.18;
        src.connect(f).connect(g).connect(master);
        src.start(t);
      };

      // Schedule a little ahead, one eighth note at a time.
      let melody = 4;
      const tick = () => {
        const { season: s, game: g } = settings.current;
        const mood = MOODS[s] ?? DEFAULT_MOOD;
        const bpm = g ? mood.bpm + 26 : mood.bpm;
        const eighth = 60 / bpm / 2;
        const loop = mood.minor ? MINOR_LOOP : MAJOR_LOOP;
        const scale = mood.minor ? MINOR_SCALE : MAJOR_SCALE;
        while (e.next < ctx.currentTime + 0.25) {
          const t = e.next;
          const bar = Math.floor(e.step / 8) % 4;
          const beat = e.step % 8;
          const root = mood.key + loop[bar];
          const third = root + (mood.minor ? (bar === 0 ? 3 : 4) : bar === 2 ? 3 : 4);
          if (beat === 0) {
            // Pad chord and bass at the top of each bar.
            for (const n of [root, third, root + 7]) voice(hz(n - 12), t, eighth * 8, "triangle", 0.05);
            voice(hz(root - 24), t, eighth * 3, "sine", 0.16);
          }
          if (beat === 4) voice(hz(root - 24 + 7), t, eighth * 3, "sine", 0.08);
          // Melody: wanders the scale, mostly on chord notes.
          if (Math.random() < (g ? 0.7 : 0.45)) {
            melody = Math.max(0, Math.min(scale.length * 2 - 1, melody + Math.round((Math.random() - 0.5) * 4)));
            const deg = scale[melody % scale.length] + 12 * Math.floor(melody / scale.length);
            voice(hz(mood.key + deg), t, eighth * (Math.random() < 0.3 ? 3 : 1.6), mood.bell ? "sine" : "triangle", mood.bell ? 0.09 : 0.07, true);
          }
          if (g) {
            // Game pages: drums and a quick arpeggio.
            if (beat % 4 === 0) drum(t, "kick");
            if (beat === 4) drum(t, "snare");
            drum(t, "hat");
            voice(hz([root, third, root + 7, root + 12][beat % 4]), t, eighth * 0.9, "square", 0.018);
          }
          e.next += eighth;
          e.step++;
        }
      };
      e.timer = setInterval(tick, 80);
    };
    const onVis = () => {
      const e = engine.current;
      if (!e) return;
      if (document.visibilityState === "hidden") void e.ctx.suspend();
      else {
        void e.ctx.resume();
        e.next = Math.max(e.next, e.ctx.currentTime + 0.1);
      }
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // Turning the music on after it was off (or off at load) starts it on the next click; turning it to 0 just fades it.
  useEffect(
    () => () => {
      const e = engine.current;
      if (e?.timer) clearInterval(e.timer);
      void e?.ctx.close();
      engine.current = null;
    },
    [],
  );
  return null;
}
