"use client";

import { useEffect, useState } from "react";
import { GameFrame } from "@/components/studio/GameFrame";
import { getToken } from "../ui";
import { Tabs, useReport, type PartyProps } from "./shared";

/**
 * A Game Studio game played as a Live mode. Right answers earn coins (kept
 * by the server); the game reads them through jace.live and reports a
 * score, which the server caps by the coins earned. The game frame stays
 * mounted while you answer questions, so switching tabs never restarts it.
 */
export function StudioMode({ view, act, earn }: PartyProps) {
  const [tab, setTab] = useState<"play" | "earn">("earn");
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState(view.me.score);
  const coins = view.party.bank ?? 0;
  const info = view.party.custom;
  useReport(act, score);

  useEffect(() => {
    fetch(`/api/live/games/${view.code}/custom`, { headers: { "X-Live-Token": getToken(view.code) ?? "" } })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "Couldn't load the game.");
        setHtml(d.html);
      })
      .catch((e) => setError(e.message));
  }, [view.code]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl bg-panel px-4 py-2 text-sm">
        <span className="truncate font-semibold">
          {info?.icon ?? "🧩"} {info?.title ?? "Studio game"}
          {info?.owner && <span className="font-normal text-muted"> by {info.owner}</span>}
        </span>
        <span className="shrink-0">🪙 {coins}</span>
      </div>
      <Tabs tab={tab} setTab={setTab} earnBadge={coins < 10 ? "!" : undefined} />
      <div className={tab === "play" ? "" : "hidden"}>
        {error ? (
          <p className="rounded-xl bg-panel p-6 text-center text-sm">{error}</p>
        ) : html === null ? (
          <p className="rounded-xl bg-panel p-6 text-center text-sm text-muted">Loading the game…</p>
        ) : (
          <GameFrame
            html={html}
            playerName={view.me.name}
            seed={hashSeed(view.code + view.me.id)}
            liveCoins={coins}
            onEarn={() => setTab("earn")}
            onScore={(n) => setScore((s) => Math.max(s, n))}
            title={info?.title ?? "Studio game"}
          />
        )}
      </div>
      {tab === "earn" && earn}
    </div>
  );
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
