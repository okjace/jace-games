import { SCALES, chordOf, melodyOf, nearestStep, scaleNote, type Note, type Song } from "./songs";

/**
 * The music maker behind every Jace Live song: soft pads, bass, a tune that
 * comes back, arpeggios and drums, with echo and reverb. It plays into any
 * audio context, so the same code plays the background music live and
 * records a theme's song into a file you can download.
 */

const hz = (semitonesFromC4: number) => 261.63 * 2 ** (semitonesFromC4 / 12);
const melodies = new WeakMap<Song, Note[][]>();
const tuneOf = (s: Song) => {
  let m = melodies.get(s);
  if (!m) melodies.set(s, (m = melodyOf(s)));
  return m;
};

export type Synth = {
  /** Plays eighth note number `step` of `song` starting at `t`; returns how long an eighth is. */
  play: (song: Song, step: number, t: number, onGame: boolean) => number;
};

/** Sets up the instruments (and echo + reverb) playing into `master`. */
export function makeSynth(ctx: BaseAudioContext, master: AudioNode): Synth {
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

  const play = (song: Song, step: number, start: number, onGame: boolean) => {
    const beat = step % 8;
    const eighth = 60 / song.bpm / 2;
    const scale = SCALES[song.scale];
    const bar = Math.floor(step / 8);
    const swing = beat % 2 === 1 ? (song.swing ?? 0) * eighth : 0;
    const t = start + swing;
    const chord = chordOf(scale, song.loop[bar % song.loop.length]);
    const [root, third, fifth] = chord;
    const key = song.key;

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
    const note = phrase[step % 16];
    if (note) {
      const pitch = key + 12 + scaleNote(scale, nearestStep(scale, root) + note.deg);
      const buzzy = song.lead === "square" || song.lead === "sawtooth";
      voice(hz(pitch), t, eighth * note.len * 0.95, song.lead, buzzy ? 0.04 : 0.085, { cut: buzzy ? 2800 : 5000, echo: true, verb: 0.35 });
      if (song.bell && (note.len > 1 || beat === 0)) bell(hz(pitch + 12), t);
    }
    // Arpeggio.
    if (song.arp.length) voice(hz(key + chord[song.arp[step % song.arp.length]]), t, eighth * 0.85, onGame ? "square" : "triangle", onGame ? 0.016 : 0.03, { cut: 2600, verb: 0.3 });

    // The beat (softer outside games).
    const b = song.beat;
    const vol = onGame ? 1 : 0.6;
    const kick = b === "four" ? beat % 2 === 0 : b === "half" ? beat === 0 : b === "break" ? beat === 0 || beat === 3 || beat === 6 : b === "shuffle" ? beat === 0 || beat === 3 || beat === 4 : b === "march" ? beat % 2 === 0 : false;
    const snare = b === "half" ? beat === 4 : b === "march" ? beat === 2 || beat === 6 || beat === 7 : b === "none" ? false : beat === 2 || beat === 6;
    if (kick) drum(t, "kick", vol);
    if (snare) drum(t, "snare", vol);
    if (b !== "none" && (b !== "half" || beat % 2 === 0)) drum(t, "hat", vol);
    return eighth;
  };
  return { play };
}

/** A WAV file from recorded audio (16-bit stereo). */
function toWav(buf: AudioBuffer): Blob {
  const ch = Math.min(2, buf.numberOfChannels);
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  out.setUint32(4, 36 + n * ch * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, ch, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * ch * 2, true);
  out.setUint16(32, ch * 2, true);
  out.setUint16(34, 16, true);
  str(36, "data");
  out.setUint32(40, n * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([out.buffer], { type: "audio/wav" });
}

/**
 * Records a song into a WAV file about `minutes` long (3 by default). It
 * changes as it goes so it doesn't get boring: the main tune, then a second
 * tune over the same chords, then a quiet part with no drums, then the main
 * tune again… ending on a fade.
 */
export async function recordSong(song: Song, minutes = 3): Promise<Blob> {
  const rate = 24000;
  const eighth = 60 / song.bpm / 2;
  // Whole 16-bar sections, as close to the length asked for as possible.
  const sectionSteps = 16 * 8;
  const sections = Math.max(1, Math.round((minutes * 60) / (sectionSteps * eighth)));
  const seconds = sections * sectionSteps * eighth + 3;
  const ctx = new OfflineAudioContext(2, Math.ceil(rate * seconds), rate);
  const master = ctx.createGain();
  master.gain.value = 1.2;
  master.gain.setValueAtTime(1.2, seconds - 6);
  master.gain.linearRampToValueAtTime(0, seconds);
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(ctx.destination);
  const synth = makeSynth(ctx, master);
  const second: Song = { ...song, seed: song.seed + 1000 };
  const quiet: Song = { ...song, seed: song.seed + 2000, beat: "none", busy: song.busy * 0.6, arp: [] };
  const parts = [song, song, second, quiet];
  let t = 0.05;
  for (let sec = 0; sec < sections; sec++) {
    // The last section is always the main tune.
    const part = sec === sections - 1 ? song : parts[sec % parts.length];
    for (let s = 0; s < sectionSteps; s++) t += synth.play(part, s, t, false);
  }
  return toWav(await ctx.startRendering());
}
