"use client";

import Link from "next/link";
import { useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import type { PlayerView } from "@/lib/live/engine";
import { MODES } from "@/lib/live/types";
import { sfx } from "./fx/sfx";

/** At the end of a game: ask if you want your score on the global leaderboard for this mode. */
export function GlobalBoardOptIn({ code, token, view }: { code: string; token: string | null; view: PlayerView }) {
  const { user } = useScores();
  const [state, setState] = useState<"ask" | "busy" | "done" | "no">("ask");
  const [msg, setMsg] = useState<string | null>(null);
  if (view.mode === "custom" || view.status !== "ended") return null;
  const name = MODES[view.mode].name;
  if (!user) {
    return (
      <p className="text-sm text-muted">
        🏆 <a href={signInHref(`/live/play/${code}`)} className="font-semibold text-accent hover:underline">sign in</a> to put scores on the {name} leaderboard
      </p>
    );
  }
  if (state === "no") return null;
  if (state === "done") {
    return (
      <p className="flex flex-wrap items-center justify-center gap-2 text-sm font-semibold">
        {msg}
        <Link href={`/leaderboards?mode=${view.mode}`} className="text-accent hover:underline">
          see the leaderboard →
        </Link>
      </p>
    );
  }
  const submit = async () => {
    setState("busy");
    const res = await fetch(`/api/live/games/${code}/leaderboard`, { method: "POST", headers: token ? { "X-Live-Token": token } : {} }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) {
      setMsg(body?.error ?? "Couldn't save it. Try again?");
      setState("ask");
      return;
    }
    if (body.best) sfx.levelUp();
    setMsg(body.best ? `🏆 ur on the ${name} leaderboard!!` : `ur best is still ${body.previous} (this one didn't beat it)`);
    setState("done");
  };
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-accent/50 bg-accent/5 px-4 py-3">
      <p className="text-sm font-bold">🏆 put this score on the global {name} leaderboard?</p>
      {msg && <p className="text-xs text-danger">{msg}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setState("no")} className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold hover:bg-foreground/[.05]">
          nah
        </button>
        <button type="button" onClick={() => void submit()} disabled={state === "busy"} className="rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-on-accent disabled:opacity-60">
          {state === "busy" ? "saving…" : "yes pls!!"}
        </button>
      </div>
    </div>
  );
}
