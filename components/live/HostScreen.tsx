"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HostView } from "@/lib/live/engine";
import { MODES, type LiveMode } from "@/lib/live/types";
import { openRoomChannel } from "@/lib/realtime/client";
import { FULLSCREEN_CLASS, FullscreenButton, useStageFullscreen } from "./fx/useStageFullscreen";
import { HostReport } from "./HostReport";
import { HtmlFrame } from "./HtmlFrame";
import { Celebration, LiveAvatar, LiveName } from "./LiveAvatar";
import { Markdown, QuestionMediaView } from "./Markdown";
import { ANSWER_COLORS, ANSWER_SHAPES, card, getToken, primary, secondary, setPin, setToken } from "./ui";

/**
 * The host's big screen. It refreshes when the server pushes a change (a
 * player joined or answered, the phase moved on) and every couple of
 * seconds anyway, and nudges the server when a timer runs out.
 */
export function HostScreen({ code }: { code: string }) {
  const [view, setView] = useState<HostView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const skew = useRef(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const full = useStageFullscreen(hostRef);
  const [showPlayers, setShowPlayers] = useState(false);
  const router = useRouter();

  /** The host joins as a player too, in a new tab (their name comes from their Jace account). */
  const playToo = async () => {
    const tab = window.open("about:blank", "_blank");
    if (!getToken(code)) {
      const res = await fetch(`/api/live/games/${code}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => null);
      const body = await res?.json().catch(() => null);
      if (!res?.ok) {
        tab?.close();
        return setError(body?.error ?? "Couldn't join your own game.");
      }
      setToken(code, body.token);
      setPin(code, body.pin ?? null);
    }
    if (tab) tab.location.href = `/live/play/${code}`;
    else router.push(`/live/play/${code}`);
  };
  const [showAnswers, setShowAnswers] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/live/games/${code}/host`, { cache: "no-store" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (!res?.ok) return setError(body?.error ?? "Couldn't load the game.");
    skew.current = body.serverNow - Date.now();
    setView(body);
  }, [code]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(() => void load(), 2000);
    return () => clearInterval(t);
  }, [load]);

  const topic = view?.topic;
  useEffect(() => {
    if (!topic) return;
    const ch = openRoomChannel(topic, null);
    const offs = ["phase", "players", "answered"].map((ev) => ch.on(ev, () => void load()));
    return () => {
      offs.forEach((off) => off());
      ch.close();
    };
  }, [topic, load]);

  const act = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    const res = await fetch(`/api/live/games/${code}/host`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) {
      skew.current = body.serverNow - Date.now();
      setView(body);
      setError(null);
    } else if (action !== "tick") setError(body?.error ?? "That didn't work.");
  }, [code]);

  // Clock for timers; when one runs out, ask the server to move on.
  const endsAt = view?.state.endsAt ?? null;
  const phase = view?.state.phase;
  useEffect(() => {
    let nudged = false;
    const t = setInterval(() => {
      const n = Date.now() + skew.current;
      setNow(n);
      if (endsAt && n >= endsAt && !nudged && (phase === "question" || phase === "running")) {
        nudged = true;
        void act("tick");
      }
    }, 250);
    return () => clearInterval(t);
  }, [endsAt, phase, act]);


  if (error && !view) return <p className={`${card} text-center text-sm text-muted`}>{error}</p>;
  if (!view) return <div className="h-80 animate-pulse rounded-2xl bg-foreground/[.04]" />;

  const mode = MODES[view.mode];
  const hasQuestions = !view.settings.noSet && view.questionCount > 0;
  const secondsLeft = view.state.endsAt ? Math.max(0, Math.ceil((view.state.endsAt - now) / 1000)) : null;
  const joinUrl = typeof window !== "undefined" ? `${window.location.host}/live` : "/live";

  return (
    <div ref={hostRef} className={`bg-background ${full.on ? `${FULLSCREEN_CLASS} p-6` : ""}`}>
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{mode.icon}</span>
            <div>
              <h1 className="text-xl font-bold">
                {mode.name}
                {view.setTitle ? ` · ${view.setTitle}` : view.settings.noSet ? " · no questions" : ""}
              </h1>
              <p className="text-sm text-muted">
                Join at <b className="text-foreground">{joinUrl}</b> with code <b className="font-mono tracking-widest text-foreground">{view.code}</b>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-pressed={showPlayers} onClick={() => setShowPlayers((v) => !v)} className={secondary}>
              👥 Players ({view.players.length})
            </button>
            {view.status !== "ended" && (
              <button type="button" onClick={() => void playToo()} title="Join this game as a player (opens a new tab)" className={secondary}>
                🎮 Play too
              </button>
            )}
            {hasQuestions && view.status === "playing" && (
              <button type="button" aria-pressed={showAnswers} onClick={() => setShowAnswers((v) => !v)} className={secondary}>
                📋 {showAnswers ? "Hide answers" : "Answers"}
              </button>
            )}
            {view.status !== "ended" && (
              <button
                type="button"
                aria-pressed={!!view.settings.public}
                onClick={() => act("public", { on: !view.settings.public })}
                title={view.settings.public ? "Anyone can find this game on Discover. Click to hide it." : "List this game on Discover so anyone can join"}
                className={secondary}
              >
                {view.settings.public ? "🌍 On Discover" : "🔒 Not listed"}
              </button>
            )}
            <FullscreenButton on={full.on} toggle={full.toggle} className="border border-line bg-panel" />
            {view.status !== "ended" && (
              <button type="button" onClick={() => confirm("End the game for everyone?") && act("end")} className={secondary}>
                End game
              </button>
            )}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        {showPlayers && <PlayerList view={view} onKick={(id) => act("kick", { playerId: id })} onClose={() => setShowPlayers(false)} />}

        {view.status === "lobby" && <Lobby view={view} busy={busy} onStart={() => act("start")} onKick={(id) => act("kick", { playerId: id })} />}

        {view.status === "playing" && view.mode === "classic" && view.current && (
          <Classic view={view} secondsLeft={secondsLeft ?? 0} busy={busy} onReveal={() => act("reveal")} onNext={() => act("next")} />
        )}

        {view.status === "playing" && view.mode !== "classic" && <SelfPaced view={view} secondsLeft={secondsLeft ?? 0} />}

        {view.status === "ended" && <Podium view={view} />}
        {view.status === "ended" && <PlayAgain view={view} busy={busy} onAgain={(m) => act("again", { mode: m })} />}

        {hasQuestions && (view.status === "ended" || (view.status === "playing" && showAnswers)) && <HostReport code={view.code} live={view.status === "playing"} />}
      </div>
    </div>
  );
}

function Lobby({ view, busy, onStart, onKick }: { view: HostView; busy: boolean; onStart: () => void; onKick: (id: string) => void }) {
  return (
    <div className={`${card} flex flex-col items-center gap-5 py-10 text-center`}>
      <p className="text-sm text-muted">Game code</p>
      <p className="font-mono text-6xl font-black tracking-[0.25em] sm:text-7xl">{view.code}</p>
      <p className="text-muted">
        {view.players.length === 0 ? "Waiting for players…" : `${view.players.length} player${view.players.length === 1 ? "" : "s"} in`}
      </p>
      <ul className="flex max-w-3xl flex-wrap justify-center gap-2">
        {view.players.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => confirm(`Remove ${p.name} from the game?`) && onKick(p.id)}
              title="Click to remove"
              className="animate-pop flex items-center gap-2 rounded-full bg-foreground/[.08] py-1.5 pl-1.5 pr-4 text-sm font-semibold hover:bg-danger/20 hover:line-through"
            >
              <LiveAvatar avatar={p.avatar} size={28} />
              <LiveName name={p.name} avatar={p.avatar} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onStart} disabled={busy || view.players.length === 0} className={`${primary} h-14 px-10 text-lg`}>
        Start
      </button>
    </div>
  );
}

function Classic({ view, secondsLeft, busy, onReveal, onNext }: { view: HostView; secondsLeft: number; busy: boolean; onReveal: () => void; onNext: () => void }) {
  const q = view.current!;
  const reveal = view.state.phase === "reveal";
  const max = Math.max(1, ...(view.counts ?? [0]));
  const last = view.current!.index + 1 >= view.questionCount;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {q.index + 1} of {view.questionCount}
        </span>
        <span>
          {view.answeredCount}/{view.players.length} answered
        </span>
      </div>
      <div className={`${card} flex flex-col items-center gap-4 py-8 text-center`}>
        {q.prompt && <Markdown text={q.prompt} className="text-2xl font-bold sm:text-4xl" />}
        <QuestionMediaView media={q.media} className="w-full max-w-3xl" />
        {q.html && <HtmlFrame html={q.html} title="Question" height={q.type === "html" ? 360 : 240} locked />}
        {!reveal && <p className={`font-mono text-5xl font-black tabular-nums ${secondsLeft <= 5 ? "text-danger" : ""}`}>{secondsLeft}</p>}
      </div>
      {(q.type === "choice" || q.type === "truefalse") && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(q.choices ?? []).map((c, i) => {
            const right = (q.correct ?? []).includes(i);
            return (
              <div
                key={i}
                className={`relative flex items-center gap-3 overflow-hidden rounded-2xl p-5 text-xl font-bold text-white transition-opacity ${reveal && !right ? "opacity-40" : ""}`}
                style={{ background: ANSWER_COLORS[i] }}
              >
                <span aria-hidden="true">{ANSWER_SHAPES[i]}</span>
                <Markdown inline text={c} className="flex-1" />
                {reveal && (
                  <span className="flex items-center gap-2 text-base">
                    {right && "✓"}
                    <span className="inline-block h-3 rounded-full bg-white/80" style={{ width: `${((view.counts?.[i] ?? 0) / max) * 80 + 4}px` }} />
                    {view.counts?.[i] ?? 0}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
      {(q.type === "type" || q.type === "html") && reveal && (
        <p className={`${card} text-center text-xl`}>
          Answer: <b>{(q.accepted ?? []).join(" / ")}</b>
        </p>
      )}
      {reveal && <Board view={view} />}
      <div className="flex justify-end gap-2">
        {reveal ? (
          <button type="button" onClick={onNext} disabled={busy} className={`${primary} h-12 px-8`}>
            {last ? "Show the podium" : "Next question"}
          </button>
        ) : (
          <button type="button" onClick={onReveal} disabled={busy} className={secondary}>
            Skip to answer
          </button>
        )}
      </div>
    </div>
  );
}

function SelfPaced({ view, secondsLeft }: { view: HostView; secondsLeft: number }) {
  const rocket = view.mode === "rocket";
  const max = Math.max(1, ...view.players.map((p) => p.score));
  return (
    <div className="flex flex-col gap-4">
      <div className={`${card} flex items-center justify-between`}>
        <p className="text-sm text-muted">
          {rocket ? "First to 100% wins" : `${MODES[view.mode].icon} ${MODES[view.mode].name}: highest score when time's up wins`}
        </p>
        <p className={`font-mono text-4xl font-black tabular-nums ${secondsLeft <= 10 ? "text-danger" : ""}`}>
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
        </p>
      </div>
      <ol className="flex flex-col gap-2">
        {view.players.slice(0, 12).map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl bg-panel px-4 py-3">
            <span className="w-6 text-center font-mono text-muted">{i + 1}</span>
            <LiveAvatar avatar={p.avatar} size={28} />
            <LiveName name={p.name} avatar={p.avatar} title={false} className="w-32 font-semibold sm:w-48" />
            <span className="relative h-6 flex-1 overflow-hidden rounded-full bg-foreground/[.06]">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500"
                style={{ width: `${rocket ? Math.min(100, p.score) : (p.score / max) * 100}%` }}
              />
              {rocket && (
                <span className="absolute top-0 text-lg transition-[left] duration-500" style={{ left: `calc(${Math.min(100, p.score)}% - 14px)` }}>
                  🚀
                </span>
              )}
            </span>
            <span className="w-28 text-right font-mono font-semibold tabular-nums">{MODES[view.mode].unit(p.score)}</span>
          </li>
        ))}
      </ol>
      {view.players.length > 12 && <p className="text-center text-sm text-muted">and {view.players.length - 12} more</p>}
    </div>
  );
}

function Board({ view }: { view: HostView }) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2">
      {view.players.slice(0, 6).map((p, i) => (
        <li key={p.id} className="flex items-center gap-3 rounded-xl bg-panel px-4 py-2">
          <span className="w-6 font-mono text-muted">{i + 1}</span>
          <LiveAvatar avatar={p.avatar} size={28} />
          <LiveName name={p.name} avatar={p.avatar} className="flex-1 font-semibold" />
          {p.streak >= 3 && <span title={`${p.streak} in a row`}>🔥{p.streak}</span>}
          <span className="font-mono tabular-nums">{p.score.toLocaleString()}</span>
        </li>
      ))}
    </ol>
  );
}

function Podium({ view }: { view: HostView }) {
  const top = view.players.slice(0, 3);
  const order = [top[1], top[0], top[2]];
  const heights = ["h-28", "h-40", "h-20"];
  const medals = ["🥈", "🥇", "🥉"];
  const winner = view.players[0];
  const fmt = MODES[view.mode].unit;
  return (
    <div className="flex flex-col gap-6">
      {winner && view.players.length > 1 && <Celebration effect={winner.avatar?.effect} />}
      <div className="flex items-end justify-center gap-3 pt-6">
        {order.map((p, i) =>
          p ? (
            <div key={p.id} className="flex w-28 flex-col items-center gap-2 sm:w-40">
              <span className="text-4xl">{medals[i]}</span>
              <LiveAvatar avatar={p.avatar} size={56} />
              <LiveName name={p.name} avatar={p.avatar} className="w-full justify-center text-center font-bold" />
              <span className="font-mono text-sm text-muted">{fmt(p.score)}</span>
              <div className={`w-full rounded-t-2xl bg-accent/80 ${heights[i]}`} />
            </div>
          ) : (
            <div key={i} className="w-28 sm:w-40" />
          ),
        )}
      </div>
      <ol className="flex flex-col gap-1">
        {view.players.map((p, i) => (
          <li key={p.id} className="flex items-center gap-3 rounded-lg px-3 py-1.5 odd:bg-foreground/[.03]">
            <span className="w-6 font-mono text-muted">{i + 1}</span>
            <LiveAvatar avatar={p.avatar} size={24} />
            <LiveName name={p.name} avatar={p.avatar} className="flex-1" />
            <span className="text-xs text-muted">
              {p.correct}/{p.answered} right
            </span>
            <span className="w-24 text-right font-mono tabular-nums">{fmt(p.score)}</span>
          </li>
        ))}
      </ol>
      <div className="flex justify-center gap-2">
        <Link href="/live/host/new" className={primary}>
          Host another game
        </Link>
        <Link href="/live" className={secondary}>
          Back to Live
        </Link>
      </div>
    </div>
  );
}

/** Everyone in the game: name, look, score, how they're doing, and a remove button. */
function PlayerList({ view, onKick, onClose }: { view: HostView; onKick: (id: string) => void; onClose: () => void }) {
  const fmt = MODES[view.mode].unit;
  return (
    <section className={`${card} flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">👥 Everyone in the game ({view.players.length})</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-foreground">
          ✕
        </button>
      </div>
      {view.players.length === 0 ? (
        <p className="text-sm text-muted">Nobody has joined yet.</p>
      ) : (
        <ol className="grid gap-1.5 sm:grid-cols-2">
          {view.players.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded-xl bg-foreground/[.04] px-3 py-2 text-sm">
              <span className="w-6 text-center font-mono text-muted">{i + 1}</span>
              <LiveAvatar avatar={p.avatar} size={28} />
              <LiveName name={p.name} avatar={p.avatar} className="min-w-0 flex-1 font-semibold" />
              <span className="shrink-0 text-xs text-muted">
                {p.correct}/{p.answered} right
                {p.finished ? " · done" : ""}
              </span>
              <span className="shrink-0 font-mono tabular-nums">{fmt(p.score)}</span>
              <button
                type="button"
                onClick={() => confirm(`Remove ${p.name} from the game?`) && onKick(p.id)}
                title={`Remove ${p.name}`}
                aria-label={`Remove ${p.name}`}
                className="shrink-0 rounded-full px-2 text-muted hover:bg-danger/15 hover:text-danger"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** After a game: run it again with the same code and everyone still here, in the same mode or a new one. */
function PlayAgain({ view, busy, onAgain }: { view: HostView; busy: boolean; onAgain: (mode: LiveMode) => void }) {
  const [mode, setMode] = useState<LiveMode>(view.mode);
  const allowed = (Object.keys(MODES) as LiveMode[]).filter((m) => (m !== "custom" || view.mode === "custom") && !(MODES[m].needsSet && view.settings.noSet));
  return (
    <section className={`${card} flex flex-wrap items-center gap-3`}>
      <span className="text-3xl">🔁</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Play again with everyone</p>
        <p className="text-sm text-muted">
          Same game code ({view.code}), the {view.players.length} player{view.players.length === 1 ? "" : "s"} still here, fresh scores.
        </p>
      </div>
      <select value={mode} onChange={(e) => setMode(e.target.value as LiveMode)} aria-label="Mode for the next game" className="h-11 rounded-full border border-line bg-background px-4 text-sm">
        {allowed.map((m) => (
          <option key={m} value={m}>
            {MODES[m].icon} {MODES[m].name}
          </option>
        ))}
      </select>
      <button type="button" disabled={busy} onClick={() => onAgain(mode)} className={primary}>
        🔁 Play again
      </button>
    </section>
  );
}
