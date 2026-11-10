"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useScores } from "@/components/ScoresProvider";
import type { PlayerView } from "@/lib/live/engine";
import { MODES } from "@/lib/live/types";
import { openRoomChannel } from "@/lib/realtime/client";
import type { Avatar } from "@/lib/live/locker";
import { Answer } from "./Answer";
import { ChatPanel } from "./ChatPanel";
import { Celebration, LiveAvatar, LiveName, guestAvatar } from "./LiveAvatar";
import { Markdown } from "./Markdown";
import { FULLSCREEN_CLASS, FullscreenButton, useStageFullscreen } from "./fx/useStageFullscreen";
import { PARTY_MODES, PartyPlay } from "./party";
import { card, getPin, getToken, input, primary, secondary, setPin, setToken } from "./ui";

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
  const playRef = useRef<HTMLDivElement>(null);
  const full = useStageFullscreen(playRef);

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

  // Solo games have no host screen to notice a timer running out, so this screen does.
  const soloEnds = view?.solo && view.status === "playing" && (view.phase === "question" || view.phase === "running") ? view.endsAt : null;
  const soloTick = useRef<number | null>(null);
  useEffect(() => {
    if (!soloEnds || !token) return;
    const wait = Math.max(0, soloEnds - (Date.now() + skew)) + 400;
    const t = setTimeout(() => {
      if (soloTick.current === soloEnds) return;
      soloTick.current = soloEnds;
      void fetch(`/api/live/games/${code}/play`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Live-Token": token },
        body: JSON.stringify({ action: "solo", op: "tick" }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => v && setView(v))
        .catch(() => {});
    }, wait);
    return () => clearTimeout(t);
  }, [soloEnds, token, skew, code]);

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
  if (!token) return <JoinForm code={code} defaultName={user?.displayName || user?.username || ""} note={error} onJoined={(t) => (setToken(code, t), setTok(t))} />;
  if (!view) return <Centered>{error ? <p className="text-muted">{error}</p> : <p className="animate-pulse text-muted">Joining…</p>}</Centered>;

  // Self-paced modes play full screen on their own stage, with their own HUD.
  if (view.status === "playing" && PARTY_MODES.includes(view.mode)) {
    return (
      <>
        {error && <p className="fixed inset-x-0 top-20 z-[60] mx-auto w-fit rounded-full bg-red-500 px-4 py-1.5 text-sm font-bold text-white shadow-lg">{error}</p>}
        <PartyPlay view={view} busy={busy} act={act} />
        {!view.solo && <ChatPanel code={code} topic={view.topic} token={token} on={view.chatOn} />}
      </>
    );
  }

  return (
    <div ref={playRef} className={full.on ? `${FULLSCREEN_CLASS} bg-background p-4` : ""}>
    {!view.solo && view.status !== "ended" && <ChatPanel code={code} topic={view.topic} token={token} on={view.chatOn} />}
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-line bg-panel px-4 py-3">
        <span className="flex min-w-0 items-center gap-2">
          <LiveAvatar avatar={view.me.avatar} size={30} />
          <LiveName name={view.me.name} avatar={view.me.avatar} className="font-semibold" />
        </span>
        <span className="flex items-center gap-3 text-sm">
          <FullscreenButton on={full.on} toggle={full.toggle} className="-my-2 text-muted hover:text-foreground" />
          {view.solo && view.status === "playing" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => confirm("End this game now? Your score so far counts.") && void act({ action: "solo", op: "end" })}
              title="End the game now"
              className="-my-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold hover:bg-foreground/[.05]"
            >
              🏁 End
            </button>
          )}
          {view.me.streak >= 2 && <span title="Streak">🔥 {view.me.streak}</span>}
          <span className="font-mono font-bold tabular-nums">{score(view, view.me.score)}</span>
          {view.status !== "lobby" && <span className="text-muted">#{view.me.rank}</span>}
        </span>
      </div>
      {error && <p className="text-center text-sm text-danger">{error}</p>}
      {view.status === "playing" && <RejoinPin code={view.code} small />}

      {view.status === "lobby" && (
        <Centered>
          <p className="text-4xl">🎉</p>
          <p className="text-xl font-bold">You&apos;re in!</p>
          <p className="text-muted">Watch the big screen. The game starts soon.</p>
          <p className="text-sm text-muted">{view.playerCount} playing</p>
          <RejoinPin code={view.code} />
        </Centered>
      )}

      {view.status === "playing" && view.mode === "classic" && <ClassicPlay view={view} busy={busy} skew={skew} act={act} />}

      {view.status === "ended" && view.solo && <SoloResults view={view} />}

      {view.status === "ended" && !view.solo && (
        <Centered>
          {view.me.rank === 1 && view.playerCount > 1 && <Celebration effect={view.me.avatar?.effect} />}
          <p className="text-5xl">{view.me.rank === 1 ? "🥇" : view.me.rank === 2 ? "🥈" : view.me.rank === 3 ? "🥉" : "🎮"}</p>
          <p className="text-2xl font-bold">
            {view.me.rank === 1 ? "You won!" : `You came #${view.me.rank} of ${view.playerCount}`}
          </p>
          <p className="text-muted">
            {score(view, view.me.score)} · {view.me.correct}/{view.me.answered} right
          </p>
          <XpGained view={view} />
          <Review view={view} />
          <Top view={view} />
          <Link href="/live" className={primary}>
            Done
          </Link>
        </Centered>
      )}
    </div>
    </div>
  );
}

const score = (v: PlayerView, n: number) => MODES[v.mode].unit(n);

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-3 text-center">{children}</div>;
}

function JoinForm({ code, defaultName, note, onJoined }: { code: string; defaultName: string; note: string | null; onJoined: (token: string) => void }) {
  const [name, setName] = useState(defaultName);
  // Signed-in players show their locker look (the server applies it); guests their saved pick.
  const [look, setLook] = useState<Avatar | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLook(guestAvatar());
  }, []);
  const [error, setError] = useState<string | null>(note);
  const [busy, setBusy] = useState(false);
  const [needsPin, setNeedsPin] = useState(false);
  const [pin, setPinText] = useState("");
  return (
    <form
      className={`${card} mx-auto flex w-full max-w-sm flex-col gap-3`}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await fetch(`/api/live/games/${code}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, avatar: guestAvatar(), ...(needsPin && pin ? { pin } : {}) }),
        }).catch(() => null);
        const body = await res?.json().catch(() => null);
        setBusy(false);
        if (res?.ok) {
          // Keep the PIN: a new one when joining, or the one they typed when rejoining.
          setPin(code, body.pin ?? (body.rejoined && pin ? pin : null));
          onJoined(body.token);
        } else {
          setError(body?.error ?? "Couldn't join.");
          if (body?.needsPin) setNeedsPin(true);
        }
      }}
    >
      <p className="text-center text-sm text-muted">
        Game <span className="font-mono font-semibold tracking-widest text-foreground">{code}</span>
      </p>
      <p className="flex items-center justify-center gap-2 text-sm text-muted">
        <LiveAvatar avatar={look} size={36} />
        <Link href="/live/locker" className="text-accent hover:underline">
          Change your look
        </Link>
      </p>
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} placeholder="Your nickname" aria-label="Nickname" autoFocus maxLength={20} className={`${input} h-12 text-center text-lg`} />
      {needsPin && (
        <input
          value={pin}
          onChange={(e) => setPinText(e.target.value.replace(/\D/g, "").slice(0, 4))}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Rejoin PIN"
          aria-label="Rejoin PIN"
          autoFocus
          className={`${input} h-12 text-center font-mono text-2xl tracking-[0.4em]`}
        />
      )}
      {error && <p className="text-center text-sm text-danger">{error}</p>}
      <button type="submit" disabled={!name.trim() || busy || (needsPin && pin.length > 0 && pin.length < 4)} className={primary}>
        {busy ? "Joining…" : needsPin && pin.length === 4 ? "Rejoin" : "Join"}
      </button>
      <p className="text-center text-xs text-muted">Left by accident? Join with the same name. Signed in, you&apos;re back right away; as a guest, enter the PIN you were shown.</p>
    </form>
  );
}

/** A guest's rejoin PIN, so they can get back in from another device if they leave by accident. */
export function RejoinPin({ code, small = false }: { code: string; small?: boolean }) {
  const [pin, setPinState] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinState(getPin(code));
  }, [code]);
  if (!pin) return null;
  if (small) {
    return (
      <p className="text-center text-xs text-muted" title="If you leave by accident, join again with the same name and this PIN.">
        🔑 Game <b className="font-mono tracking-widest text-foreground">{code}</b> · Rejoin PIN <b className="font-mono tracking-widest text-foreground">{pin}</b>
      </p>
    );
  }
  return (
    <p className="rounded-xl bg-foreground/[.05] px-4 py-2 text-sm">
      🔑 Your rejoin PIN: <b className="font-mono text-lg tracking-widest">{pin}</b>
      <span className="block text-xs text-muted">Left by accident? Join game {code} again with the same name and this PIN.</span>
    </p>
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
        {view.solo ? (
          <button type="button" autoFocus disabled={busy} onClick={() => void act({ action: "solo", op: "next" })} className={primary}>
            {q.index + 1 >= q.total ? "See results" : "Next question →"}
          </button>
        ) : (
          <p className="text-sm text-muted">
            You&apos;re #{view.me.rank} of {view.playerCount}
          </p>
        )}
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

/** The end of a solo game: how you did, and the same game again in one tap. */
function SoloResults({ view }: { view: PlayerView }) {
  const router = useRouter();
  const { user } = useScores();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const again = async () => {
    const p = view.solo!;
    setBusy(true);
    const res = await fetch("/api/live/solo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setId: p.setId, mode: view.mode, settings: { minutes: p.minutes, shuffle: p.shuffle, mapId: p.mapId, gameId: p.gameId }, avatar: guestAvatar() }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) {
      setToken(body.code, body.token);
      setPin(body.code, body.pin ?? null);
      router.push(`/live/play/${body.code}`);
    } else {
      setError(body?.error ?? "Couldn't start another game.");
      setBusy(false);
    }
  };
  const def = MODES[view.mode];
  return (
    <Centered>
      <p className="text-5xl">{def.icon}</p>
      <Celebration effect={view.me.avatar?.effect} />
      <p className="text-2xl font-bold">Nice run!</p>
      <p className="text-4xl font-black tabular-nums">{score(view, view.me.score)}</p>
      <p className="text-muted">
        {def.name}
        {view.me.answered > 0 && !view.noSet ? ` · ${view.me.correct}/${view.me.answered} right` : ""}
      </p>
      <XpGained view={view} />
      <Review view={view} />
      {user && !view.noSet && (view.review?.length ?? 0) > 0 && (
        <Link href="/live/reports" className="text-sm text-accent hover:underline">
          📋 Saved to your Reports
        </Link>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={again} disabled={busy} className={primary}>
          {busy ? "Starting…" : "🔁 Play again"}
        </button>
        <Link href="/live/host/new?solo=1" className={secondary}>
          Change game
        </Link>
        <Link href="/live" className={secondary}>
          Done
        </Link>
      </div>
    </Centered>
  );
}

/** After a game: every question you answered, what you said, and (for the ones you missed) the right answer. */
function Review({ view }: { view: PlayerView }) {
  const items = view.review ?? [];
  const wrong = items.filter((r) => !r.correct).length;
  const [onlyWrong, setOnlyWrong] = useState(wrong > 0);
  if (items.length === 0) return null;
  const shown = onlyWrong ? items.map((r, i) => ({ r, i })).filter(({ r }) => !r.correct) : items.map((r, i) => ({ r, i }));
  return (
    <details className="w-full rounded-2xl border border-line bg-panel text-left" open={wrong > 0 && wrong <= 10}>
      <summary className="cursor-pointer select-none px-4 py-3 font-semibold">
        Your answers: {items.length - wrong} right, {wrong} wrong
      </summary>
      <div className="flex flex-col gap-2 px-4 pb-4">
        {wrong > 0 && (
          <div className="flex gap-1 text-xs">
            {[true, false].map((only) => (
              <button
                key={String(only)}
                type="button"
                aria-pressed={onlyWrong === only}
                onClick={() => setOnlyWrong(only)}
                className={`rounded-full px-3 py-1 font-semibold ${onlyWrong === only ? "bg-accent text-on-accent" : "bg-foreground/[.06] text-muted"}`}
              >
                {only ? `Missed (${wrong})` : `All (${items.length})`}
              </button>
            ))}
          </div>
        )}
        <ol className="flex flex-col gap-2">
          {shown.map(({ r, i }) => (
            <li key={i} className={`rounded-xl border-l-4 p-3 text-sm ${r.correct ? "border-green-500 bg-green-500/[.07]" : "border-red-500 bg-red-500/[.07]"}`}>
              <p className="font-semibold">
                {r.correct ? "✅" : "❌"} <Markdown inline text={r.prompt} />
              </p>
              <p className="mt-1 text-muted">
                You said: <span className={r.correct ? "font-semibold text-foreground" : "line-through"}>{r.yours}</span>
              </p>
              {!r.correct && r.right && (
                <p>
                  Right answer: <b className="text-green-600 dark:text-green-400">{r.right}</b>
                </p>
              )}
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}

/** "+45 XP" after a game, for signed-in players. */
function XpGained({ view }: { view: PlayerView }) {
  if (view.me.xp === null) return null;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Link href="/live/locker" className="rounded-full bg-accent/15 px-4 py-1.5 text-sm font-bold text-accent hover:bg-accent/25">
        +{view.me.xp} XP · open your locker →
      </Link>
      {view.me.xpParts.length > 1 && (
        <ul className="flex flex-wrap justify-center gap-1 text-xs text-muted">
          {view.me.xpParts.map((p, i) => (
            <li key={i} className="rounded-full bg-foreground/[.05] px-2 py-0.5">
              {p.label} +{p.xp}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Top({ view }: { view: PlayerView }) {
  return (
    <ol className="flex w-full flex-col gap-1 text-sm">
      {view.top.map((p, i) => (
        <li key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${p.you ? "bg-accent/10 ring-1 ring-accent/30" : "bg-foreground/[.03]"}`}>
          <span className="w-5 font-mono text-muted">{i + 1}</span>
          <LiveAvatar avatar={p.avatar} size={24} />
          <LiveName name={p.name} avatar={p.avatar} className="flex-1" />
          <span className="font-mono tabular-nums">{score(view, p.score)}</span>
        </li>
      ))}
    </ol>
  );
}
