"use client";

import { useEffect, useRef, useState } from "react";
import { setAudio, useAudio } from "@/lib/audioSettings";
import { LookToggle } from "@/components/site/LookToggle";
import { EffectsToggle } from "@/components/site/Seasonal";
import { useSeason } from "@/components/site/ThemeContext";
import { setGameOff, useGameOff } from "@/components/site/privacy";
import { leaveCall } from "./callClient";
import { guestAvatar } from "./LiveAvatar";
import { getPin, setPin, setToken } from "./ui";

/**
 * ⚙️ Game settings on a player's screen: sound and music, fullscreen, light
 * or dark, falling stuff, chat and calls off for me, the game code, ur
 * rejoin code (hidden until u tap it), and a box to type a rejoin code.
 */
export function GameSettingsMenu({
  code,
  signedIn,
  solo = false,
  fullscreen,
  chatAvailable = false,
  callsAvailable = false,
  watching = false,
  className = "",
}: {
  code: string;
  signedIn: boolean;
  solo?: boolean;
  fullscreen?: { on: boolean; toggle: () => void };
  chatAvailable?: boolean;
  callsAvailable?: boolean;
  /** On the watch page: offers switching to playing (and hides the player-only parts). */
  watching?: boolean;
  className?: string;
}) {
  const { sfx, music } = useAudio();
  const season = useSeason();
  const off = useGameOff(code);
  const [open, setOpen] = useState(false);
  const [pin, setPinState] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [typed, setTyped] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinState(getPin(code));
    const away = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("pointerdown", away);
      window.removeEventListener("keydown", esc);
    };
  }, [open, code]);

  const rejoin = async () => {
    if (!name.trim() || !/^\d{4}$/.test(typed)) return setMsg("type ur name n the 4-number rejoin code");
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/live/games/${code}/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), pin: typed, avatar: guestAvatar() }) }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok || !body?.token) return setMsg(body?.error ?? "couldnt rejoin :(");
    if (!body.rejoined) return setMsg("that made a new player instead. check the name matches ur old one exactly.");
    setToken(code, body.token);
    setPin(code, typed);
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label="Game settings" title="game settings" className={className}>
        ⚙️
      </button>
      {open && (
        <div className="jl-pop-in absolute right-0 top-11 z-[80] flex max-h-[80vh] w-80 flex-col gap-3 overflow-y-auto rounded-2xl border border-line bg-panel p-4 text-left text-sm text-foreground shadow-xl">
          <p className="font-display text-lg font-extrabold">⚙️ game settings</p>
          {/* Player or watcher: ur spot stays saved on this device, so u can switch back. */}
          {!solo && (
            <a
              href={watching ? `/live/play/${code}` : `/live/watch/${code}`}
              className="flex items-center justify-between rounded-xl border border-line px-3 py-2 font-semibold hover:bg-accent/10"
            >
              <span>{watching ? "🎮 switch to playing" : "👀 switch to watching"}</span>
              <span className="text-xs text-muted">{watching ? "join or get ur spot back" : "ur spot stays saved"}</span>
            </a>
          )}
          {/* Sound */}
          {(
            [
              ["💥 sound effects", sfx, (v: number) => setAudio({ sfx: v })],
              ["🎶 music", music, (v: number) => setAudio({ music: v })],
            ] as const
          ).map(([label, value, set]) => (
            <label key={label} className="flex flex-col gap-1">
              <span className="flex items-center justify-between font-semibold">
                {label} <span className="font-mono text-xs text-muted">{value === 0 ? "off" : `${Math.round(value * 100)}%`}</span>
              </span>
              <input type="range" min={0} max={100} value={Math.round(value * 100)} onChange={(e) => set(Number(e.target.value) / 100)} className="accent-[var(--accent)]" />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAudio({ sfx: 0, music: 0 })} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-accent/10">
              🔇 mute all
            </button>
            {fullscreen && (
              <button type="button" onClick={fullscreen.toggle} className="rounded-full border border-line px-3 py-1 text-xs font-semibold hover:bg-accent/10">
                {fullscreen.on ? "🗗 exit fullscreen" : "⛶ fullscreen"}
              </button>
            )}
          </div>
          <LookToggle />
          <div className="flex items-center justify-between rounded-xl bg-foreground/[.04] px-3 py-1">
            <span className="font-semibold">falling stuff</span>
            <EffectsToggle season={season} />
          </div>
          {/* Chat and calls, just for me */}
          {!solo && !watching && (chatAvailable || callsAvailable) && (
            <div className="flex flex-col gap-1.5 rounded-xl bg-foreground/[.04] p-3">
              {chatAvailable && (
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={!off.chat} disabled={off.locked.chat} onChange={(e) => setGameOff(code, "chat", !e.target.checked)} />
                  <span>💬 chat {off.locked.chat && <span className="text-xs text-muted">(off for ur whole account)</span>}</span>
                </label>
              )}
              {callsAvailable && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!off.calls}
                    disabled={off.locked.calls}
                    onChange={(e) => {
                      setGameOff(code, "calls", !e.target.checked);
                      if (!e.target.checked) void leaveCall();
                    }}
                  />
                  <span>📞 voice calls {off.locked.calls && <span className="text-xs text-muted">(off for ur whole account)</span>}</span>
                </label>
              )}
              <p className="text-xs text-muted">just for u, in this game. turn them off evrywhere in ur profile settings.</p>
            </div>
          )}
          {!solo && (
            <p>
              🎮 game code <b className="font-mono text-lg tracking-widest">{code}</b>
            </p>
          )}
          {!solo && !watching && (
          <>
          <div className="flex flex-col gap-1 rounded-xl bg-foreground/[.05] p-3">
            <p className="font-semibold">🔑 ur rejoin code</p>
            {signedIn ? (
              <p className="text-xs text-muted">ur signed in, so u dont need one: just join this game again w/ the same name.</p>
            ) : pin ? (
              <>
                <button type="button" onClick={() => setShow((v) => !v)} className="self-start rounded-full border border-line px-3 py-1 font-mono text-lg tracking-widest hover:bg-accent/10">
                  {show ? pin : "••••"} <span className="font-sans text-xs text-muted">{show ? "hide" : "show"}</span>
                </button>
                <p className="text-xs text-muted">left by accident or switching devices? use ur same name + this code. keep it secret!</p>
              </>
            ) : (
              <p className="text-xs text-muted">this device doesnt have one saved.</p>
            )}
          </div>
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void rejoin();
            }}
          >
            <p className="font-semibold">got a rejoin code?</p>
            <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="ur name in the game" aria-label="Your name in the game" className="h-9 rounded-full border border-line bg-background px-3 outline-none focus:border-accent" />
            <div className="flex gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 4))}
                inputMode="numeric"
                placeholder="1234"
                aria-label="Rejoin code"
                className="h-9 w-24 rounded-full border border-line bg-background px-3 text-center font-mono tracking-widest outline-none focus:border-accent"
              />
              <button type="submit" disabled={busy} className="flex-1 rounded-full bg-accent px-3 font-bold text-on-accent disabled:opacity-60">
                {busy ? "…" : "rejoin here"}
              </button>
            </div>
            {msg && <p className="text-xs font-semibold text-danger">{msg}</p>}
          </form>
          </>
          )}
        </div>
      )}
    </div>
  );
}

/** The line under a game: just the game code (nothing in solo games). */
export function GameCodeLine({ code, solo }: { code: string; solo: boolean }) {
  if (solo) return null;
  return (
    <p className="text-center text-xs opacity-80">
      🎮 game <b className="font-mono tracking-widest">{code}</b>
    </p>
  );
}
