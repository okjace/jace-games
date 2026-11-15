"use client";

import { useState } from "react";
import { SEASONS } from "@/lib/seasons";
import { MOOD_SONGS, SONG_FILES, THEME_SONGS, songFileName } from "@/lib/songs";
import { recordSong } from "@/lib/synth";
import { useMyCustomTheme, useSeason } from "./ThemeContext";

/**
 * Download ur theme's music. A custom theme with its own uploaded song gives
 * that file; every other theme's song (made up live as it plays) gets
 * downloaded as a 3 minute MP3 recorded ahead of time (in development it
 * gets recorded right here instead). Shows in the appearance menu and in
 * ur profile's theme settings.
 */
export function ThemeMusicDownload({ compact = false }: { compact?: boolean }) {
  const season = useSeason();
  const custom = useMyCustomTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const isCustom = (season as string) === "custom" && custom;
  const name = isCustom ? custom.data.name : (SEASONS[season]?.name ?? "Jace Live");
  const file = isCustom && custom.data.music ? custom.data.music : null;
  // The live site has every song recorded ahead of time, so it's an instant download.
  const ready = process.env.NODE_ENV === "production" ? `${SONG_FILES}/${songFileName(isCustom ? `mood-${custom.data.mood}` : season in THEME_SONGS ? season : "plain")}` : null;

  const record = async () => {
    setBusy(true);
    setError(false);
    try {
      const song = isCustom ? MOOD_SONGS[custom.data.mood] : (THEME_SONGS[season] ?? THEME_SONGS.plain);
      const url = URL.createObjectURL(await recordSong(song));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "jace-live"} music.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError(true);
    }
    setBusy(false);
  };

  const btn = "shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-on-accent hover:bg-accent-hover disabled:opacity-60";
  return (
    <div className={`flex items-center gap-3 rounded-xl bg-foreground/[.04] ${compact ? "px-3 py-2" : "p-3"}`}>
      <span className="text-xl" aria-hidden="true">
        🎵
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold">{file ? "this theme has its own song" : `${name} music`}</span>
        {!compact && (
          <span className="block text-xs text-muted">{error ? "couldnt make the file :( try again" : file ? `from “${name}”. save it to listen anywhere` : "a 3 min version of this theme's song to listen anywhere"}</span>
        )}
        {compact && error && <span className="block text-xs text-danger">couldnt make the file :(</span>}
      </span>
      {file ? (
        <a href={`/api/live/media/${file}?download=${encodeURIComponent(`${name} music`)}`} download className={btn}>
          ⬇️ download
        </a>
      ) : ready ? (
        <a href={ready} download className={btn}>
          ⬇️ download
        </a>
      ) : (
        <button type="button" onClick={() => void record()} disabled={busy} className={btn}>
          {busy ? "🎙️ recording… (~30 sec)" : "⬇️ download"}
        </button>
      )}
    </div>
  );
}
