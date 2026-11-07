"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import type { PlayerView } from "@/lib/live/engine";
import { MODES } from "@/lib/live/types";
import { openRoomChannel } from "@/lib/realtime/client";
import { Answer } from "./Answer";
import { PARTY_MODES, PartyPlay } from "./party";
import { card, getToken, input, primary, setToken } from "./ui";

/** A player's screen for a Live game (usually a phone). */
export function PlayLive({ code }: { code: string }) {
  const { user } = useScores();
  const [token, setTok] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<PlayerView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [skew, setSkew] = useState(0);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTok(getToken(code));
    setLoaded(true);
  }, [code]);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`/api/live/games/${code}/play`, { headers: { "X-Live-Token": token }, cache: "no-store" }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.status === 401) {
      setToken(code, null);
      setTok(null);
      return setError(body?.error ?? null);
    }
    if (!res?.ok) return setError(body?.error ?? "Couldn't reach the game.");
    setSkew(body.serverNow - Date.now());
    setView(body);
    setError(null);
  }, [code, token]);

  useEffect(() => {
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    const t = setInterval(() => document.visibilityState === "visible" && void load(), 4000);
    return () => clearInterval(t);
  }, [token, load]);

  const topic = view?.topic;
  const myId = view?.me.id;
  useEffect(() => {
    if (!topic) return;
    const ch = openRoomChannel(topic, null);
    const offs = [
      ch.on("phase", () => void load()),
      ch.on("kicked", (p) => {
        if ((p as { playerId?: string }).playerId === myId) {
          setToken(code, null);
          setKicked(true);
        }
      }),
    ];
    return () => {
      offs.forEach((off) => off());
      ch.close();
    };
  }, [topic, myId, load, code]);

  const act = async (body: Record<string, unknown>) => {
    if (!token) return null;
    setBusy(true);
    const res = await fetch(`/api/live/games/${code}/play`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Live-Token": token },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (res?.ok) {
      setSkew(data.serverNow - Date.now());
      setView(data);
      setError(null);
      return data as PlayerView;
    }
    if (res?.status !== 429) setError(data?.error ?? "That didn't go through.");
    if (res?.status === 409) void load();
    return null;
  };

  if (kicked) {
    return (
      <Centered>
        <p className="text-4xl">👋</p>
        <p className="text-lg font-semibold">The host removed you from this game.</p>
        <Link href="/live" className={primary}>
          Back to Live
        </Link>
      </Centered>
    );
  }
  if (!loaded) return null;
  if (!token) return <JoinForm code={code} defaultName={user?.username ?? ""} note={error} onJoined={(t) => (setToken(code, t), setTok(t))} />;
  if (!view) return <Centered>{error ? <p className="text-muted">{error}</p> : <p className="animate-pulse text-muted">Joining…</p>}</Centered>;

  // Self-paced modes play full screen on their own stage, with their own HUD.
  if (view.status === "playing" && PARTY_MODES.includes(view.mode)) {
    return (
      <>
        {error && <p className="fixed inset-x-0 top-20 z-[60] mx-auto w-fit rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white shadow-lg">{error}</p>}
        <PartyPlay view={view} busy={busy} act={act} />
      </>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3">
        <span className="truncate font-semibold">{view.me.name}</span>
        <span className="flex items-center gap-3 text-sm">
          {view.me.streak >= 2 && <span title="Streak">🔥 {view.me.streak}</span>}
          <span className="font-mono font-bold tabular-nums">{score(view, view.me.score)}</span>
          {view.status !== "lobby" && <span className="text-muted">#{view.me.rank}</span>}
        </span>
      </div>
      {error && <p className="text-center text-sm text-danger">{error}</p>}

      {view.status === "lobby" && (
        <Centered>
          <p className="text-4xl">🎉</p>
          <p className="text-xl font-bold">You&apos;re in!</p>
          <p className="text-muted">Watch the big screen. The game starts soon.</p>
          <p className="text-sm text-muted">{view.playerCount} playing</p>
        </Centered>
      )}

      {view.status === "playing" && view.mode === "classic" && <ClassicPlay view={view} busy={busy} skew={skew} act={act} />}

      {view.status === "ended" && (
        <Centered>
          <p className="text-5xl">{view.me.rank === 1 ? "🥇" : view.me.rank === 2 ? "🥈" : view.me.rank === 3 ? "🥉" : "🎮"}</p>
          <p className="text-2xl font-bold">
            {view.me.rank === 1 ? "You won!" : `You came #${view.me.rank} of ${view.playerCount}`}
          </p>
          <p className="text-muted">
            {score(view, view.me.score)} · {view.me.correct}/{view.me.answered} right
          </p>
          <Top view={view} />
          <Link href="/live" className={primary}>
            Done
          </Link>
        </Centered>
      )}
    </div>
  );
}

const score = (v: PlayerView, n: number) => MODES[v.mode].unit(n);

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-3 text-center">{children}</div>;
}

function JoinForm({ code, defaultName, note, onJoined }: { code: string; defaultName: string; note: string | null; onJoined: (token: string) => void }) {
  const [name, setName] = useState(defaultName);
  const [error, setError] = useState<string | null>(note);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={`${card} mx-auto flex w-full max-w-sm flex-col gap-3`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch(`/api/live/games/${code}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }).catch(() => null);
        const body = await res?.json().catch(() => null);
        setBusy(false);
        if (res?.ok) onJoined(body.token);
        else setError(body?.error ?? "Couldn't join.");
      }}
    >
      <p className="text-center text-sm text-muted">
        Game <span className="font-mono font-semibold tracking-widest text-foreground">{code}</span>
      </p>
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="Your nickname" aria-label="Nickname" autoFocus maxLength={20} className={`${input} h-12 text-center text-lg`} />
      {error && <p className="text-center text-sm text-danger">{error}</p>}
      <button type="submit" disabled={!name.trim() || busy} className={primary}>
        {busy ? "Joining…" : "Join"}
      </button>
    </form>
  );
}

function useSecondsLeft(endsAt: number | null, skew: number) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - (Date.now() + skew)) / 1000)));
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [endsAt, skew]);
  return left;
}

function ClassicPlay({ view, busy, skew, act }: { view: PlayerView; busy: boolean; skew: number; act: (b: Record<string, unknown>) => Promise<PlayerView | null> }) {
  const left = useSecondsLeft(view.phase === "question" ? view.endsAt : null, skew);
  const q = view.question;
  if (!q) return <Centered><p className="animate-pulse text-muted">Get ready…</p></Centered>;
  const a = view.myAnswer;

  if (view.phase === "reveal") {
    const right = a?.correct;
    return (
      <Centered>
        <p className="text-5xl">{a ? (right ? "✅" : "❌") : "⏰"}</p>
        <p className="text-2xl font-bold">{a ? (right ? "Correct!" : "Not quite") : "Time's up"}</p>
        {a && right && <p className="text-lg">+{a.pts.toLocaleString()} points</p>}
        {!right && view.reveal && (
          <p className="text-muted">
            The answer was{" "}
            <b className="text-foreground">
              {q.type === "choice" || q.type === "truefalse" ? (view.reveal.correct ?? []).map((i) => q.choices?.[i]).join(" / ") : (view.reveal.accepted ?? []).join(" / ")}
            </b>
          </p>
        )}
        <p className="text-sm text-muted">
          You&apos;re #{view.me.rank} of {view.playerCount}
        </p>
      </Centered>
    );
  }

  if (a) {
    return (
      <Centered>
        <p className="text-4xl">⏳</p>
        <p className="text-xl font-bold">Answer locked in!</p>
        <p className="text-muted">Waiting for everyone else…</p>
      </Centered>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question {q.index + 1} of {q.total}
        </span>
        <span className={`font-mono text-lg font-bold tabular-nums ${left !== null && left <= 5 ? "text-danger" : "text-foreground"}`}>{left ?? ""}</span>
      </div>
      <Answer q={q} disabled={busy || left === 0} onAnswer={(ans) => void act({ action: "answer", answer: ans })} />
    </div>
  );
}

function Top({ view }: { view: PlayerView }) {
  return (
    <ol className="flex w-full flex-col gap-1 text-sm">
      {view.top.map((p, i) => (
        <li key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p.you ? "bg-accent/10 ring-1 ring-accent/30" : "bg-foreground/[.03]"}`}>
          <span className="w-5 font-mono text-muted">{i + 1}</span>
          <span className="flex-1 truncate">{p.name}</span>
          <span className="font-mono tabular-nums">{score(view, p.score)}</span>
        </li>
      ))}
    </ol>
  );
}
