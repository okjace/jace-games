"use client";

import { useMyCustomTheme } from "./ThemeContext";

/**
 * When ur theme has its own uploaded song: a little box to download it.
 * Shows in the appearance menu and in ur profile's theme settings.
 */
export function ThemeMusicDownload({ compact = false }: { compact?: boolean }) {
  const theme = useMyCustomTheme();
  const music = theme?.data.music;
  if (!theme || !music) return null;
  const href = `/api/live/media/${music}?download=${encodeURIComponent(`${theme.data.name} music`)}`;
  return (
    <div className={`flex items-center gap-3 rounded-xl bg-foreground/[.04] ${compact ? "px-3 py-2" : "p-3"}`}>
      <span className="text-xl" aria-hidden="true">
        🎵
      </span>
      <span className="min-w-0 flex-1 text-sm">
        <span className="block font-semibold">this theme has its own song</span>
        {!compact && <span className="block text-xs text-muted">from &ldquo;{theme.data.name}&rdquo;. save it to listen anywhere</span>}
      </span>
      <a href={href} download className="shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-on-accent hover:bg-accent-hover">
        ⬇️ download
      </a>
    </div>
  );
}
