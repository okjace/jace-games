"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getAudio, useAudio } from "@/lib/audioSettings";
import type { SeasonId } from "@/lib/seasons";
import { currentCustom } from "@/lib/customThemes";
import { currentGameMode } from "@/lib/gameMusic";
import { GAME_SONGS, MOOD_SONGS, THEME_SONGS, type Song } from "@/lib/songs";
import { makeSynth } from "@/lib/synth";

/**
 * Background music for all of Jace Live, made on the fly with Web Audio (no
 * files). Every theme has its own song, and so does every game mode (on the
 * play and host screens). Songs have soft detuned pads, a bass line, a beat,
 * and a real tune that comes back (A A B A) instead of random notes, with a
 * bit of echo and reverb. A custom theme can bring its own uploaded song instead. It starts after the first click or key press
 * (browsers don't allow sound before that), follows the Music slider, only
 * plays in one tab, and goes quiet while the tab is hidden.
 */

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
      const synth = makeSynth(ctx, master);

      const e: Engine = { ctx, master, timer: null, next: ctx.currentTime + 0.2, step: 0, track: null };
      engine.current = e;
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
          const eighth = synth.play(song, e.step, e.next, settings.current.game);
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
    // Clicking into a game on the page (a Studio game's frame) also "blurs" the window,
    // but the page still has focus then, so the music keeps going.
    const blur = () => {
      setTimeout(() => {
        if (document.hasFocus() || document.activeElement?.tagName === "IFRAME") return;
        const e = engine.current;
        if (e) void e.ctx.suspend();
        e?.track?.el.pause();
      }, 0);
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
