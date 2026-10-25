"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Fullscreen } from "@/components/Fullscreen";
import { useScores } from "@/components/ScoresProvider";
import { signInHref } from "@/components/site/SiteHeader";
import { timeAgo } from "@/lib/format";
import type { GameView } from "@/lib/studio/server";
import type { GameSummary } from "@/lib/db/studio";
import { GameFrame } from "./GameFrame";
import { api, card, input, primary, secondary, small } from "./ui";

type ScoreRow = { user_id: string; username: string; score: number; created_at: string };

/** /community/[id]: play a published game, its (unverified) leaderboard, play with friends, report. */
export function CommunityGame({ view }: { view: GameView & { meta: GameSummary } }) {
  const { user } = useScores();
  const router = useRouter();
  const { meta, game } = view;
  const [scores, setScores] = useState<ScoreRow[] | null>(null);
  const [notice, setNotice] = useState<{ kind: "error" | "info"; text: string } | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState("");
  const [removed, setRemoved] = useState(view.removed);
  const [busy, setBusy] = useState(false);

  const loadScores = useCallback(() => {
    if (!game) return;
    api<{ scores: ScoreRow[] }>(`/api/studio/games/${meta.id}/scores`)
      .then((d) => setScores(d.scores))
      .catch(() => setScores([]));
  }, [game, meta.id]);

  useEffect(() => {
    loadScores();
    if (game) void fetch(`/api/studio/games/${meta.id}/play`, { method: "POST" }).catch(() => {});
  }, [loadScores, game, meta.id]);

  async function onScore(score: number) {
    if (!user) {
      setNotice({ kind: "info", text: `You scored ${score}. Sign in with Jace to get on the leaderboard.` });
      return;
    }
    try {
      const r = await api<{ best: boolean }>(`/api/studio/games/${meta.id}/scores`, { method: "POST", body: { score } });
      setNotice({ kind: "info", text: r.best ? `New best: ${score}!` : `You scored ${score}.` });
      if (r.best) loadScores();
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    }
  }

  async function playWithFriends() {
    setBusy(true);
    try {
      const { code } = await api<{ code: string }>("/api/rooms", { method: "POST", body: { game: `c:${meta.id}` } });
      router.push(`/r/${code}`);
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
      setBusy(false);
    }
  }

  async function sendReport() {
    try {
      await api(`/api/studio/games/${meta.id}/report`, { method: "POST", body: { reason } });
      setReporting(false);
      setReason("");
      setNotice({ kind: "info", text: "Thanks. The site owner will take a look." });
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    }
  }

  async function takeDown(next: boolean) {
    try {
      await api(`/api/studio/games/${meta.id}/remove`, { method: "POST", body: { removed: next } });
      setRemoved(next);
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message });
    }
  }

  const isOwn = user?.id === meta.owner_id;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-4xl" aria-hidden="true">
            {meta.icon}
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              {meta.title}
              {meta.multiplayer && (
                <span className="ml-2 align-middle text-sm font-normal text-muted" title="Multiplayer">
                  👥 {meta.multiplayer.min}–{meta.multiplayer.max}
                </span>
              )}
            </h1>
            <p className="text-sm text-muted">
              by {meta.owner_name} · {meta.plays} {meta.plays === 1 ? "play" : "plays"}
              {meta.published_at && ` · ${timeAgo(meta.published_at)}`} · made with {meta.kind === "blocks" ? "blocks" : "code"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {meta.multiplayer &&
            game &&
            !removed &&
            (user ? (
              <button type="button" className={primary} onClick={playWithFriends} disabled={busy}>
                👥 Play with friends
              </button>
            ) : (
              <a href={signInHref(`/community/${meta.id}`)} className={primary}>
                Sign in to play with friends
              </a>
            ))}
          {isOwn && (
            <Link href={`/studio/${meta.id}`} className={secondary}>
              Edit
            </Link>
          )}
        </div>
      </div>

      {removed && (
        <p className="rounded-2xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          This game was taken down by the site owner. Only {view.isSiteOwner ? "you and its maker" : "its maker"} can see it.
        </p>
      )}
      {!game && <p className="rounded-2xl border border-line bg-panel px-4 py-3 text-sm text-muted">This game isn&apos;t published.</p>}
      {notice && (
        <p
          role={notice.kind === "error" ? "alert" : "status"}
          className={`rounded-2xl border px-4 py-3 text-sm ${notice.kind === "error" ? "border-danger/40 bg-danger/10 text-danger" : "border-accent/40 bg-accent/10"}`}
        >
          {notice.text}
        </p>
      )}

      {game && (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="min-w-0">
            <Fullscreen label={meta.title}>
              <GameFrame html={game.html} playerName={user?.username ?? "Guest"} runKey={runKey} title={meta.title} onScore={onScore} autoFocus />
            </Fullscreen>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className={small} onClick={() => setRunKey((k) => k + 1)}>
                ↻ Restart
              </button>
              <span className="text-xs text-muted">Click the game to use the keyboard.</span>
              {user && !isOwn && (
                <button type="button" className={`${small} ml-auto`} onClick={() => setReporting((r) => !r)} aria-expanded={reporting}>
                  ⚑ Report
                </button>
              )}
              {view.isSiteOwner && (
                <button type="button" className={`${small} text-danger`} onClick={() => takeDown(!removed)}>
                  {removed ? "Put back" : "Take down"}
                </button>
              )}
            </div>
            {reporting && (
              <div className={`${card} mt-3 flex flex-col gap-2 p-4`}>
                <label htmlFor="report" className="text-sm font-medium">
                  What&apos;s wrong with this game?
                </label>
                <textarea id="report" className={`${input} h-20 py-2`} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <button type="button" className={primary} onClick={sendReport} disabled={!reason.trim()}>
                    Send report
                  </button>
                  <button type="button" className={secondary} onClick={() => setReporting(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {meta.description && <p className="mt-4 whitespace-pre-wrap text-sm text-muted">{meta.description}</p>}
          </section>
          <aside className="flex flex-col gap-3">
            <div className="rounded-2xl border border-line bg-panel p-4">
              <h2 className="text-sm font-semibold">Leaderboard</h2>
              <p className="mb-3 text-xs text-muted">Unverified: the game reports its own scores.</p>
              {!scores ? (
                <p className="text-sm text-muted">Loading…</p>
              ) : scores.length === 0 ? (
                <p className="text-sm text-muted">No scores yet.</p>
              ) : (
                <ol className="space-y-1.5 text-sm">
                  {scores.map((s, i) => (
                    <li key={s.user_id} className={`flex items-center gap-2 ${s.user_id === user?.id ? "font-semibold text-accent" : ""}`}>
                      <span className="w-5 text-right text-muted tabular-nums">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{s.username}</span>
                      <span className="font-mono tabular-nums">{s.score}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {view.isSiteOwner && view.reports && (
              <div className="rounded-2xl border border-line bg-panel p-4">
                <h2 className="mb-2 text-sm font-semibold">Reports ({view.reports.length})</h2>
                <ul className="space-y-2 text-xs">
                  {view.reports.map((r, i) => (
                    <li key={i}>
                      <span className="text-muted">{timeAgo(r.created_at)}:</span> {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
