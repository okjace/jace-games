"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import type { PlayerView } from "@/lib/live/engine";
import type { PlayerQuestion } from "@/lib/live/types";
import { openRoomChannel } from "@/lib/realtime/client";
import { HtmlFrame } from "./HtmlFrame";
import { ANSWER_COLORS, ANSWER_SHAPES, card, getToken, input, primary, setToken } from "./ui";

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
      {view.status === "playing" && view.mode !== "classic" && <SelfPlay view={view} busy={busy} skew={skew} act={act} />}

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

const score = (v: PlayerView, n: number) => (v.mode === "rocket" ? `${n}%` : v.mode === "gold" ? `💰 ${n.toLocaleString()}` : n.toLocaleString());

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

/** Answer buttons/inputs for a question, used by every mode. */
function Answer({ q, disabled, onAnswer }: { q: PlayerQuestion; disabled: boolean; onAnswer: (a: number | string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="flex flex-col gap-3">
      {q.prompt && <p className="text-center text-xl font-bold">{q.prompt}</p>}
      {q.html && <HtmlFrame html={q.html} title="Question" height={q.type === "html" ? 340 : 220} locked={disabled} onAnswer={q.type === "html" ? (v) => onAnswer(v) : undefined} />}
      {(q.type === "choice" || q.type === "truefalse") && (
        <div className="grid grid-cols-2 gap-3">
          {(q.choices ?? []).map((c, i) => (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(i)}
              className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl p-3 text-lg font-bold text-white transition-transform active:scale-95 disabled:opacity-60"
              style={{ background: ANSWER_COLORS[i] }}
            >
              <span aria-hidden="true" className="text-2xl">
                {ANSWER_SHAPES[i]}
              </span>
              <span className="text-sm sm:text-base">{c}</span>
            </button>
          ))}
        </div>
      )}
      {q.type === "type" && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onAnswer(text.trim());
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} placeholder="Type your answer" aria-label="Your answer" disabled={disabled} autoFocus className={`${input} h-12 text-lg`} />
          <button type="submit" disabled={disabled || !text.trim()} className={primary}>
            Send
          </button>
        </form>
      )}
      {q.type === "html" && <p className="text-center text-xs text-muted">Answer in the box above.</p>}
    </div>
  );
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

const CHEST_TEXT: Record<string, (l: Record<string, unknown>) => string> = {
  gain: (l) => `+${l.amount} gold!`,
  double: (l) => `Double! +${l.amount} gold`,
  steal: (l) => `You stole ${l.amount} gold from ${l.target}!`,
  swap: (l) => `You swapped gold with ${l.target}!`,
  lose: (l) => `Oh no, you lost ${Math.abs(Number(l.amount))} gold`,
  nothing: () => "Empty chest!",
};

function SelfPlay({ view, busy, skew, act }: { view: PlayerView; busy: boolean; skew: number; act: (b: Record<string, unknown>) => Promise<PlayerView | null> }) {
  const left = useSecondsLeft(view.endsAt, skew);
  const [feedback, setFeedback] = useState<Record<string, unknown> | null>(null);
  const gold = view.mode === "gold";
  const fetching = useRef(false);

  // With questions on, always have the next one ready (unless a chest is waiting).
  const needsQuestion = !view.noSet && !view.selfQuestion && view.chests === null && !feedback;
  useEffect(() => {
    if (!needsQuestion || fetching.current) return;
    fetching.current = true;
    void act({ action: "next" }).finally(() => (fetching.current = false));
  }, [needsQuestion, act]);

  // Someone stole from or swapped with you.
  const last = view.last;
  const robbed = last && (last.kind === "robbed" || last.kind === "swapped") ? last : null;

  const after = (v: PlayerView | null) => {
    if (!v?.last) return;
    if (v.last.kind === "answer" || (v.mode === "rocket" && view.noSet)) {
      if (v.chests === null) setFeedback(v.last);
    } else if (v.last.kind === "chest") setFeedback(v.last);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-xl bg-panel px-4 py-2 text-sm">
        <span className="text-muted">{gold ? "Most gold wins" : "First to 100% wins"}</span>
        <span className="font-mono font-bold tabular-nums">
          {left !== null ? `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : ""}
        </span>
      </div>

      {!gold && (
        <div className="relative h-10 overflow-hidden rounded-full bg-foreground/[.06]">
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-500" style={{ width: `${view.me.score}%` }} />
          <span className="absolute top-1 text-2xl transition-[left] duration-500" style={{ left: `calc(${view.me.score}% - 18px)` }}>
            🚀
          </span>
        </div>
      )}

      {robbed && (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-center text-sm text-danger">
          {robbed.kind === "robbed" ? `${robbed.by} stole ${robbed.amount} of your gold!` : `${robbed.by} swapped gold with you!`}
        </p>
      )}

      {view.chests !== null ? (
        <Centered>
          <p className="text-xl font-bold">Pick a chest!</p>
          <div className="flex gap-3">
            {Array.from({ length: view.chests }, (_, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={async () => after(await act({ action: "pick", chest: i }))}
                className="flex h-24 w-24 items-center justify-center rounded-2xl border-2 border-warn bg-warn/10 text-5xl transition-transform hover:scale-105 active:scale-95"
                aria-label={`Chest ${i + 1}`}
              >
                🎁
              </button>
            ))}
          </div>
        </Centered>
      ) : feedback ? (
        <Centered>
          {feedback.kind === "chest" ? (
            <>
              <p className="text-5xl">{feedback.chest === "lose" ? "💸" : feedback.chest === "nothing" ? "🫥" : feedback.chest === "steal" ? "🦝" : feedback.chest === "swap" ? "🔄" : "💰"}</p>
              <p className="text-xl font-bold">{(CHEST_TEXT[String(feedback.chest)] ?? CHEST_TEXT.gain)(feedback)}</p>
              {typeof feedback.note === "string" && <p className="text-sm text-muted">{feedback.note}</p>}
            </>
          ) : feedback.correct === false ? (
            <>
              <p className="text-5xl">❌</p>
              <p className="text-xl font-bold">Not quite</p>
              {Array.isArray(feedback.right) && <p className="text-muted">It was {(feedback.right as string[]).join(" / ")}</p>}
            </>
          ) : (
            <>
              <p className="text-5xl">✅</p>
              <p className="text-xl font-bold">{view.mode === "rocket" ? `Boost! +${feedback.boost ?? ""}%` : "Correct!"}</p>
            </>
          )}
          <button type="button" autoFocus onClick={() => setFeedback(null)} className={primary}>
            Next
          </button>
        </Centered>
      ) : view.noSet ? (
        <Centered>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const v = await act({ action: "tap" });
              if (v && gold && v.chests !== null) setFeedback(null);
            }}
            className="flex h-48 w-48 items-center justify-center rounded-full bg-accent text-3xl font-black text-on-accent shadow-[0_8px_0_rgba(0,0,0,0.25)] transition-transform active:translate-y-1 active:scale-95"
          >
            {gold ? "TAP!" : "BOOST!"}
          </button>
          <p className="text-sm text-muted">{gold ? "Every tap opens a chest." : "Every tap fires your rocket."}</p>
        </Centered>
      ) : view.selfQuestion ? (
        <Answer key={`${view.me.answered}`} q={view.selfQuestion} disabled={busy} onAnswer={async (ans) => after(await act({ action: "answer", answer: ans }))} />
      ) : (
        <Centered>
          <p className="animate-pulse text-muted">Loading a question…</p>
        </Centered>
      )}

      <Top view={view} />
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
