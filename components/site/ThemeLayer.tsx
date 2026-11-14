"use client";

import { useEffect } from "react";
import { Corners } from "./Corners";
import { EGGS } from "./MoreEggs";
import { Music } from "./Music";
import { SeasonBackdrop } from "./SeasonFx";
import { Garland, SeasonalSky } from "./Seasonal";
import { loadPrefs, useModes, useSeason } from "./ThemeContext";

/** Everything the viewer's theme draws: falling things, the background, corner trees and the music. */
export function ThemeLayer() {
  const season = useSeason();
  const modes = useModes();
  const chaos = modes.includes("chaos");
  const chill = modes.includes("chill");

  // Ur theme settings from ur account (when signed in), once per page load.
  useEffect(() => {
    void loadPrefs();
  }, []);

  // Chaos mode: a random easter egg every so often.
  useEffect(() => {
    if (!chaos) return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const pool = EGGS.filter((e) => !["pro", "realone", "help"].includes(e.id));
      pool[Math.floor(Math.random() * pool.length)].run();
    }, 40_000);
    return () => clearInterval(t);
  }, [chaos]);

  return (
    <>
      {!chill && <SeasonalSky season={season} boost={chaos ? 3 : 1} />}
      <SeasonBackdrop season={season} />
      <Corners season={season} />
      <Music season={season} />
    </>
  );
}

/** The garland under the menu bar, for the viewer's theme. */
export function ThemedGarland() {
  return <Garland season={useSeason()} />;
}
