"use client";

import { usePathname } from "next/navigation";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";

/** A small pill saying where the player's scores are: on Jace, waiting, or on this device. */
export function SyncStatus({ className = "" }: { className?: string }) {
  const { sync, pendingCount, retry } = useScores();
  const pathname = usePathname();

  const dot = (color: string) => <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${color}`} />;
  const base = `inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1 text-xs font-medium ${className}`;

  switch (sync) {
    case "synced":
      return <span className={base}>{dot("bg-accent")}Synced with Jace</span>;
    case "syncing":
      return <span className={base}>{dot("bg-accent animate-pulse")}Syncing with Jace…</span>;
    case "pending":
      return (
        <span className={base}>
          {dot("bg-warn")}
          {pendingCount} score{pendingCount === 1 ? "" : "s"} waiting to sync
        </span>
      );
    case "coming-soon":
      return (
        <span className={base} title="Your scores are kept on this device and will upload once Jace turns sync on.">
          {dot("bg-muted")}Sync with Jace is coming soon
        </span>
      );
    case "reauth":
      return (
        <a href={signInHref(pathname)} className={`${base} hover:bg-foreground/[.05]`}>
          {dot("bg-warn")}Sign in again to sync
        </a>
      );
    case "error":
      return (
        <button type="button" onClick={retry} className={`${base} hover:bg-foreground/[.05]`}>
          {dot("bg-danger")}Couldn&apos;t sync — retry
        </button>
      );
    default:
      return <span className={base}>{dot("bg-muted")}Scores saved on this device</span>;
  }
}
