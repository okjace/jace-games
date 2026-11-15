// Records every theme's and mood's song (3 min each) into MP3s for instant downloads.
//
//   npm i --no-save node-web-audio-api@1      (needs ffmpeg with libmp3lame too)
//   node scripts/record-theme-songs.mjs [ids…]  → ./theme-songs/jace-live-<id>.mp3
//   gh release create theme-songs-vN theme-songs/*.mp3   (then bump SONG_FILES in lib/songs.ts)
//
// It runs lib/synth.ts in Node (copied to a temp folder so its imports resolve).
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OfflineAudioContext } from "node-web-audio-api";

globalThis.OfflineAudioContext = OfflineAudioContext;
const tmp = mkdtempSync(join(tmpdir(), "jl-songs-"));
copyFileSync("lib/songs.ts", join(tmp, "songs.ts"));
writeFileSync(join(tmp, "synth.ts"), readFileSync("lib/synth.ts", "utf8").replace('from "./songs"', 'from "./songs.ts"'));
const { THEME_SONGS, MOOD_SONGS, songFileName } = await import(join(tmp, "songs.ts"));
const { recordSong } = await import(join(tmp, "synth.ts"));
mkdirSync("theme-songs", { recursive: true });
const only = process.argv.slice(2);
const all = [...Object.entries(THEME_SONGS), ...Object.entries(MOOD_SONGS).map(([k, v]) => [`mood-${k}`, v])];
for (const [id, song] of all) {
  if (only.length && !only.includes(id)) continue;
  const wav = join(tmp, `${id}.wav`);
  writeFileSync(wav, Buffer.from(await (await recordSong(song)).arrayBuffer()));
  // Even out the volume to a normal music level while compressing.
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", wav, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "128k", join("theme-songs", songFileName(id))]);
  console.log("recorded", id);
}
rmSync(tmp, { recursive: true, force: true });
