"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getAudio, useAudio } from "@/lib/audioSettings";
import type { SeasonId } from "@/lib/seasons";
import { currentCustom } from "@/lib/customThemes";
import { currentGameMode } from "@/lib/gameMusic";
import { GAME_SONGS, MOOD_SONGS, SCALES, THEME_SONGS, chordOf, melodyOf, nearestStep, scaleNote, type Note, type Song } from "@/lib/songs";

/**
 * Background music for all of Jace Live, made on the fly with Web Audio (no
 * files). Every theme has its own song, and so does every game mode (on the
 * play and host screens). Songs have soft detuned pads, a bass line, a beat,
 * and a real tune that comes back (A A B A) instead of random notes, with a
 * bit of echo and reverb. A custom theme can bring its own uploaded song instead. It starts after the first click or key press
 * (browsers don't allow sound before that), follows the Music slider, only
 * plays in one tab, and goes quiet while the tab is hidden.
 */

const hz = (semitonesFromC4: number) => 261.63 * 2 ** (semitonesFromC4 / 12);
const melodies = new WeakMap<Song, Note[][]>();
const tuneOf = (s: Song) => {
  let m = melodies.get(s);
  if (!m) melodies.set(s, (m = melodyOf(s)));
  return m;
};

/** The song for right now: the game's, else the theme's (a bit livelier on game pages). */
function pickSong(season: SeasonId, game: boolean): Song {
  const gm = game ? currentGameMode() : null;
  if (gm) return GAME_SONGS[gm];
  const custom = (season as string) === "custom" ? currentCustom() : null;
  const base = custom ? MOOD_SONGS[custom.mood] : (THEME_SONGS[season] ?? THEME_SONGS.plain);
  return game ? { ...base, bpm: base.bpm + 20, beat: base.beat === "none" ? "half" : base.beat } : base;
}

/** An uploaded song playing instead of the made-up music (a custom theme's own music). */
type Track = { src: string; el: HTMLAudioElement };
type Engine = { ctx: AudioContext; master: GainNode; timer: ReturnType<typeof setInterval> | null; next: number; step: number; track: Track | null };

/** The custom theme's uploaded song to play right now (not on game pages: games keep their own songs). */
function trackFor(season: SeasonId, game: boolean): string | null {
  const custom = (season as string) === "custom" ? currentCustom() : null;
  return !game && custom?.music ? `/api/live/media/${custom.music}` : null;
}

export function Music({ season }: { season: SeasonId }) {
  const pathname = usePathname();
  const { music } = useAudio();
  const game = pathname.startsWith("/live/play/") || (pathname.startsWith("/live/host/") && pathname !== "/live/host/new");
  const engine = useRef<Engine | null>(null);
  const settings = useRef({ season, game });
  useEffect(() => {
    settings.current = { season, game };
  }, [season, game]);

  // Follow the Music slider.
  useEffect(() => {
    const e = engine.current;
    if (e) e.master.gain.setTargetAtTime(music * 1.4, e.ctx.currentTime, 0.2);
    if (e?.track) e.track.el.volume = Math.min(1, music);
  }, [music]);

  useEffect(() => {
    // Only one tab plays music: the one you used last tells the others to pause.
    const me = Math.random().toString(36).slice(2);
    let bc: BroadcastChannel | null = null;
    try {
      bc = new BroadcastChannel("jace-live-music");
      bc.onmessage = (m) => {
        const e = engine.current;
        if ((m.data as { claim?: string })?.claim !== me && e) {
          void e.ctx.suspend();
          e.track?.el.pause();
        }
      };
    } catch {}
    const claim = () => {
      bc?.postMessage({ claim: me });
      const e = engine.current;
      if (e && e.ctx.state === "suspended" && document.visibilityState === "visible") {
        void e.ctx.resume();
        e.next = Math.max(e.next, e.ctx.currentTime + 0.1);
      }
      if (e?.track && e.track.el.paused && document.visibilityState === "visible") void e.track.el.play().catch(() => {});
    };
    const start = () => {
      claim();
      // One music player per page, even if this component mounts twice (hot reload, strict mode).
      const g = globalThis as unknown as { __jlMusicOn?: boolean };
      if (engine.current || g.__jlMusicOn || getAudio().music === 0) return;
      g.__jlMusicOn = true;
      let ctx: AudioContext;
      try {
        ctx = new AudioContext();
      } catch {
        g.__jlMusicOn = false;
        return;
      }
      const master = ctx.createGain();
      master.gain.value = 0;
      master.gain.setTargetAtTime(getAudio().music * 1.4, ctx.currentTime, 1.5);
      // A limiter so it can be loud without crackling.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.ratio.value = 8;
      master.connect(limiter).connect(ctx.destination);
      // Echo for the tune…
      const delay = ctx.createDelay();
      delay.delayTime.value = 0.3;
      const fb = ctx.createGain();
      fb.gain.value = 0.25;
      delay.connect(fb).connect(delay);
      const wet = ctx.createGain();
      wet.gain.value = 0.22;
      delay.connect(wet).connect(master);
      // …and a room for everything to sit in (reverb from a made-up echo of noise).
      const verb = ctx.createConvolver();
      const irLen = Math.floor(ctx.sampleRate * 2.4);
      const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < irLen; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / irLen) ** 3;
      }
      verb.buffer = ir;
      const verbOut = ctx.createGain();
      verbOut.gain.value = 0.4;
      verb.connect(verbOut).connect(master);

      const e: Engine = { ctx, master, timer: null, next: ctx.currentTime + 0.2, step: 0, track: null };
      engine.current = e;

      type Opts = { cut?: number; attack?: number; echo?: boolean; verb?: number; detune?: number };
      const voice = (f: number, t: number, d: number, type: OscillatorType, v: number, o: Opts = {}) => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f, t);
        if (o.detune) osc.detune.value = o.detune;
        const filt = ctx.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.value = o.cut ?? 6000;
        const g = ctx.createGain();
        const a = o.attack ?? Math.min(0.03, d * 0.2);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(v, t + a);
        g.gain.setTargetAtTime(0.0001, t + Math.max(a, d * 0.7), d * 0.2 + 0.04);
        osc.connect(filt).connect(g).connect(master);
        if (o.echo) g.connect(delay);
        if (o.verb) {
          const s = ctx.createGain();
          s.gain.value = o.verb;
          g.connect(s).connect(verb);
        }
        osc.start(t);
        osc.stop(t + d + 0.8);
      };
      const bell = (f: number, t: number) => {
        voice(f, t, 0.9, "sine", 0.05, { attack: 0.005, verb: 0.8, echo: true });
        voice(f * 3.01, t, 0.35, "sine", 0.012, { attack: 0.003, verb: 0.6 });
      };
      const pad = (song: Song, tones: number[], t: number, d: number) => {
        for (const n of tones.slice(0, 3)) {
          const lo = hz(song.key + n - 12);
          if (song.pad === "warm") {
            voice(lo, t, d, "sawtooth", 0.016, { cut: 900, attack: d * 0.3, detune: -8, verb: 0.6 });
            voice(lo, t, d, "sawtooth", 0.016, { cut: 900, attack: d * 0.3, detune: 8, verb: 0.6 });
          } else if (song.pad === "glass") {
            voice(lo * 2, t, d, "sine", 0.026, { attack: d * 0.25, verb: 0.9 });
            voice(lo * 4, t, d, "triangle", 0.008, { attack: d * 0.3, detune: 5, verb: 0.9 });
          } else if (song.pad === "organ") {
            voice(lo, t, d, "square", 0.01, { cut: 1300, attack: 0.08, verb: 0.5 });
            voice(lo / 2, t, d, "sine", 0.02, { attack: 0.08 });
          } else if (song.pad === "bright") {
            voice(lo, t, d, "sawtooth", 0.013, { cut: 2200, attack: d * 0.15, detune: -10, verb: 0.4 });
            voice(lo, t, d, "sawtooth", 0.013, { cut: 2200, attack: d * 0.15, detune: 10, verb: 0.4 });
          }
        }
      };
      const bass = (n: number, t: number, d: number, v = 0.17) => {
        voice(hz(n), t, d, "sine", v, { attack: 0.01 });
        // A little buzz an octave up so phone speakers can hear it.
        voice(hz(n + 12), t, d * 0.8, "triangle", v * 0.22, { cut: 1200, attack: 0.01 });
      };
      const noise = (len: number) => {
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * len), ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        return buf;
      };
      const hat = noise(0.04);
      const snareBuf = noise(0.14);
      const drum = (t: number, kind: "kick" | "hat" | "snare", vol: number) => {
        if (kind === "kick") {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.setValueAtTime(150, t);
          o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
          g.gain.setValueAtTime(0.5 * vol, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
          o.connect(g).connect(master);
          o.start(t);
          o.stop(t + 0.22);
          return;
        }
        const src = ctx.createBufferSource();
        const f = ctx.createBiquadFilter();
        const g = ctx.createGain();
        src.buffer = kind === "hat" ? hat : snareBuf;
        f.type = kind === "hat" ? "highpass" : "bandpass";
        f.frequency.value = kind === "hat" ? 8000 : 1800;
        g.gain.value = (kind === "hat" ? 0.07 : 0.18) * vol;
        src.connect(f).connect(g).connect(master);
        if (kind === "snare") {
          const s = ctx.createGain();
          s.gain.value = 0.3;
          g.connect(s).connect(verb);
        }
        src.start(t);
      };

      // Schedule a little ahead, one eighth note at a time. The song is picked at the top of each bar.
      let song = pickSong(settings.current.season, settings.current.game);
      const tick = () => {
        // A custom theme's own uploaded song plays instead (looping); the made-up music waits.
        const src = trackFor(settings.current.season, settings.current.game);
        if (src !== (e.track?.src ?? null)) {
          e.track?.el.pause();
          e.track = null;
          if (src) {
            const el = new Audio(src);
            el.loop = true;
            el.volume = Math.min(1, getAudio().music);
            if (ctx.state === "running") void el.play().catch(() => {});
            e.track = { src, el };
          }
          e.step = 0;
        }
        if (e.track) {
          e.next = ctx.currentTime + 0.1;
          return;
        }
        while (e.next < ctx.currentTime + 0.3) {
          const beat = e.step % 8;
          if (beat === 0) {
            const want = pickSong(settings.current.season, settings.current.game);
            // A different song starts from its beginning.
            if (want.seed !== song.seed || want.bpm !== song.bpm) e.step = 0;
            song = want;
          }
          const eighth = 60 / song.bpm / 2;
          const scale = SCALES[song.scale];
          const bar = Math.floor(e.step / 8);
          const swing = beat % 2 === 1 ? (song.swing ?? 0) * eighth : 0;
          const t = e.next + swing;
          const chord = chordOf(scale, song.loop[bar % song.loop.length]);
          const [root, third, fifth] = chord;
          const key = song.key;
          const onGame = settings.current.game;

          if (beat === 0) pad(song, chord, t, eighth * 8);
          // Bass.
          if (song.bass === "root") {
            if (beat === 0) bass(key + root - 24, t, eighth * 3);
            if (beat === 4) bass(key + fifth - 24, t, eighth * 3, 0.12);
          } else if (song.bass === "walk") {
            if (beat % 2 === 0) {
              const nextRoot = chordOf(scale, song.loop[(bar + 1) % song.loop.length])[0];
              const walk = [root, third, fifth, nextRoot + (nextRoot > root ? -1 : 1)][beat / 2];
              bass(key + walk - 24, t, eighth * 1.8, 0.15);
            }
          } else if (song.bass === "pulse") bass(key + root - 24, t, eighth * 0.8, 0.12);
          else if (song.bass === "octave") bass(key + root - (beat % 2 ? 12 : 24), t, eighth * 0.9, 0.12);

          // The tune.
          const phrase = tuneOf(song)[Math.floor(bar / 2) % 4];
          const note = phrase[e.step % 16];
          if (note) {
            const pitch = key + 12 + scaleNote(scale, nearestStep(scale, root) + note.deg);
            const buzzy = song.lead === "square" || song.lead === "sawtooth";
            voice(hz(pitch), t, eighth * note.len * 0.95, song.lead, buzzy ? 0.04 : 0.085, { cut: buzzy ? 2800 : 5000, echo: true, verb: 0.35 });
            if (song.bell && (note.len > 1 || beat === 0)) bell(hz(pitch + 12), t);
          }
          // Arpeggio.
          if (song.arp.length) voice(hz(key + chord[song.arp[e.step % song.arp.length]]), t, eighth * 0.85, onGame ? "square" : "triangle", onGame ? 0.016 : 0.03, { cut: 2600, verb: 0.3 });

          // The beat (softer outside games).
          const b = song.beat;
          const vol = onGame ? 1 : 0.6;
          const kick = b === "four" ? beat % 2 === 0 : b === "half" ? beat === 0 : b === "break" ? beat === 0 || beat === 3 || beat === 6 : b === "shuffle" ? beat === 0 || beat === 3 || beat === 4 : b === "march" ? beat % 2 === 0 : false;
          const snare = b === "half" ? beat === 4 : b === "march" ? beat === 2 || beat === 6 || beat === 7 : b === "none" ? false : beat === 2 || beat === 6;
          if (kick) drum(t, "kick", vol);
          if (snare) drum(t, "snare", vol);
          if (b !== "none" && (b !== "half" || beat % 2 === 0)) drum(t, "hat", vol);

          e.next += eighth;
          e.step++;
        }
      };
      e.timer = setInterval(tick, 80);
    };
    const onVis = () => {
      const e = engine.current;
      if (!e) return;
      if (document.visibilityState === "hidden") {
        void e.ctx.suspend();
        e.track?.el.pause();
      } else claim();
    };
    const focus = () => engine.current && claim();
    // Leaving the tab (or window) pauses the music, so two tabs never play over each other.
    const blur = () => {
      const e = engine.current;
      if (e) void e.ctx.suspend();
      e?.track?.el.pause();
    };
    window.addEventListener("pointerdown", start);
    window.addEventListener("keydown", start);
    window.addEventListener("focus", focus);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", start);
      window.removeEventListener("keydown", start);
      window.removeEventListener("focus", focus);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", onVis);
      bc?.close();
    };
  }, []);

  // Leaving the page for good: stop and free the audio.
  useEffect(
    () => () => {
      const e = engine.current;
      if (e?.timer) clearInterval(e.timer);
      e?.track?.el.pause();
      void e?.ctx.close();
      engine.current = null;
      (globalThis as unknown as { __jlMusicOn?: boolean }).__jlMusicOn = false;
    },
    [],
  );
  return null;
}
