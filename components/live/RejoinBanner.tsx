"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import { MODES, type LiveMode } from "@/lib/live/types";
import { getToken, joinedCodes, primary, setToken } from "./ui";

type Active = { code: string; mode: LiveMode; name: string; status: string; solo: boolean; here: boolean };

/**
 * Games you're still in (left by accident: pressed Back, closed the tab, or
 * switched devices). Games saved in this browser are checked with their
 * key; when signed in, your games on other devices are listed too and
 * rejoin in one tap. Shown on the Live home page and the Play solo page.
 */
export function RejoinBanner() {
  const { user } = useScores();
  const router = useRouter();
  const [games, setGames] = useState<Active[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stop = false;
    (async () => {
      const here = await Promise.all(
        joinedCodes()
          .slice(0, 8)
          .map(async (code): Promise<Active | null> => {
            const token = getToken(code);
            if (!token) return null;
            const res = await fetch(`/api/live/games/${code}/play`, { headers: { "X-Live-Token": token }, cache: "no-store" }).catch(() => null);
            if (res?.status === 401 || res?.status === 404) {
              setToken(code, null); // that game is gone (or they were removed)
              return null;
            }
            const v = res?.ok ? await res.json().catch(() => null) : null;
            return v && v.status !== "ended" ? { code, mode: v.mode, name: v.me.name, status: v.status, solo: !!v.solo, here: true } : null;
          }),
      );
      const list = here.filter((g): g is Active => !!g);
      if (user) {
        const mine = await fetch("/api/live/mine", { cache: "no-store" })
          .then((r) => (r.ok ? r.json() : { games: [] }))
          .catch(() => ({ games: [] }));
        for (const g of mine.games as Omit<Active, "here">[]) if (!list.some((x) => x.code === g.code)) list.push({ ...g, here: false });
      }
      if (!stop) setGames(list.slice(0, 6));
    })();
    return () => {
      stop = true;
    };
  }, [user]);

  const rejoin = async (g: Active) => {
    if (g.here) return router.push(`/live/play/${g.code}`);
    setError(null);
    const res = await fetch(`/api/live/games/${g.code}/rejoin`, { method: "POST" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setError(body?.error ?? "Couldn't rejoin that game.");
    setToken(g.code, body.token);
    router.push(`/live/play/${g.code}`);
  };

  if (games.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent/[.06] p-4">
      <p className="font-semibold">👋 You&apos;re still in {games.length === 1 ? "a game" : `${games.length} games`}</p>
      <ul className="flex flex-wrap gap-2">
        {games.map((g) => (
          <li key={g.code}>
            <button type="button" onClick={() => void rejoin(g)} className={primary}>
              {MODES[g.mode]?.icon} Rejoin {g.solo ? "solo " : ""}
              {MODES[g.mode]?.name ?? "game"} {g.solo ? "" : `${g.code} `}as {g.name}
              {g.status === "lobby" ? " (waiting to start)" : ""}
              {!g.here && " · from another device"}
            </button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-danger">{error}</p>}
    </section>
  );
}
