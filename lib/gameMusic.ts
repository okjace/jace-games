import { useEffect } from "react";
import type { LiveMode } from "./live/types";

/**
 * Which Live game is on screen, so the music player can play that game's own
 * song (see GAME_SONGS in songs.ts). Game screens call useGameMusic.
 */

let mode: LiveMode | null = null;
/** The game on screen right now (null when not in a game). */
export const currentGameMode = () => mode;

export function useGameMusic(m: LiveMode | null | undefined) {
  useEffect(() => {
    if (!m) return;
    mode = m;
    return () => {
      if (mode === m) mode = null;
    };
  }, [m]);
}
